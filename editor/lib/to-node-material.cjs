// Builds a NodeMaterial graph that reproduces a StandardMaterial or a PBRMaterial, so a material
// made in the inspector can move on to the Node Material Editor without starting from scratch.
//
// Pure Babylon.js: takes the BABYLON namespace, no editor access (testable with a NullEngine).
// Covered: colors, alpha, diffuse/albedo, emissive, normal (bump), PBR metallic/roughness (ORM
// texture), ambient occlusion, environment reflections, fog, back-face culling and alpha mode.
// Everything else is listed in `notes` so the user knows what to redo in the graph.
//
// Inputs the user will want to tweak are flagged visibleInInspector, so they show in the
// editor's inspector of the converted material like the properties of the original.

function createGraph(BABYLON, material) {
  const T = BABYLON.NodeMaterialBlockConnectionPointTypes;
  const SV = BABYLON.NodeMaterialSystemValues;
  const target = BABYLON.NodeMaterialBlockTargets;

  const attribute = (name) => {
    const block = new BABYLON.InputBlock(name, target.Vertex, T.AutoDetect);
    block.setAsAttribute(name);
    return block.output;
  };
  const system = (name, value) => {
    const block = new BABYLON.InputBlock(name, target.Vertex, T.AutoDetect);
    block.setAsSystemValue(value);
    return block.output;
  };
  const value = (name, v) => {
    const type =
      typeof v === 'number' ? T.Float : v.getClassName() === 'Color4' ? T.Color4 : v.getClassName() === 'Color3' ? T.Color3 : T.Vector3;
    const block = new BABYLON.InputBlock(name, target.Fragment, type);
    block.value = typeof v === 'number' ? v : v.clone();
    block.visibleInInspector = true;
    return block.output;
  };
  const binary = (Block) => (name, a, b) => {
    const block = new Block(name);
    a.connectTo(block.left);
    b.connectTo(block.right);
    return block.output;
  };
  const multiply = binary(BABYLON.MultiplyBlock);
  const add = binary(BABYLON.AddBlock);
  const connect = (output, block, inputName) => {
    const input = block.getInputByName(inputName);
    if (!input) throw new Error(`${block.getClassName()} has no input "${inputName}".`);
    output.connectTo(input);
  };

  const uvs = new Map();
  const uv = (index) => {
    if (!uvs.has(index)) uvs.set(index, attribute(index ? 'uv2' : 'uv'));
    return uvs.get(index);
  };
  const texture = (name, tex) => {
    const block = new BABYLON.TextureBlock(name);
    block.texture = tex;
    uv(tex.coordinatesIndex ?? 0).connectTo(block.uv);
    return block;
  };

  // Vertex: world position and normal, clip position.
  const position = attribute('position');
  const world = system('World', SV.World);
  const view = system('View', SV.View);
  const cameraPosition = system('CameraPosition', SV.CameraPosition);

  const worldPosition = new BABYLON.TransformBlock('WorldPosition');
  worldPosition.complementZ = 0;
  worldPosition.complementW = 1;
  position.connectTo(worldPosition.vector);
  world.connectTo(worldPosition.transform);

  const worldNormal = new BABYLON.TransformBlock('WorldNormal');
  worldNormal.complementZ = 0;
  worldNormal.complementW = 0;
  attribute('normal').connectTo(worldNormal.vector);
  world.connectTo(worldNormal.transform);

  const clipPosition = new BABYLON.TransformBlock('ClipPosition');
  worldPosition.output.connectTo(clipPosition.vector);
  system('ViewProjection', SV.ViewProjection).connectTo(clipPosition.transform);
  const vertexOutput = new BABYLON.VertexOutputBlock('VertexOutput');
  clipPosition.output.connectTo(vertexOutput.vector);

  const normalFrom = (bumpTexture) => {
    if (!bumpTexture) return worldNormal.output;
    const map = texture('NormalMap', bumpTexture);
    const perturb = new BABYLON.PerturbNormalBlock('PerturbNormal');
    worldPosition.output.connectTo(perturb.worldPosition);
    worldNormal.output.connectTo(perturb.worldNormal);
    uv(bumpTexture.coordinatesIndex ?? 0).connectTo(perturb.uv);
    map.rgb.connectTo(perturb.normalMapColor);
    value('NormalStrength', bumpTexture.level ?? 1).connectTo(perturb.strength);
    return perturb.output;
  };

  const withFog = (color, scene) => {
    if (!material.fogEnabled || !scene.fogEnabled || scene.fogMode === BABYLON.Scene.FOGMODE_NONE) return color;
    const fog = new BABYLON.FogBlock('Fog');
    worldPosition.output.connectTo(fog.worldPosition);
    view.connectTo(fog.view);
    color.connectTo(fog.input);
    system('FogColor', SV.FogColor).connectTo(fog.fogColor);
    return fog.output;
  };

  return {
    T,
    value,
    multiply,
    add,
    connect,
    texture,
    normalFrom,
    withFog,
    vertexOutput,
    worldPosition: worldPosition.output,
    worldNormal: worldNormal.output,
    position,
    world,
    view,
    cameraPosition,
  };
}

function buildStandard(BABYLON, source, g, notes) {
  let diffuse = g.value('DiffuseColor', source.diffuseColor);
  let alpha = g.value('Alpha', source.alpha);
  if (source.diffuseTexture) {
    const tex = g.texture('DiffuseTexture', source.diffuseTexture);
    diffuse = g.multiply('Diffuse', diffuse, tex.rgb);
    if (source.diffuseTexture.hasAlpha || source.useAlphaFromDiffuseTexture) alpha = g.multiply('DiffuseAlpha', alpha, tex.a);
  }
  if (source.opacityTexture) {
    const tex = g.texture('OpacityTexture', source.opacityTexture);
    alpha = g.multiply('Opacity', alpha, source.opacityTexture.getAlphaFromRGB ? tex.r : tex.a);
  }

  let emissive = g.value('EmissiveColor', source.emissiveColor);
  if (source.emissiveTexture) emissive = g.multiply('Emissive', emissive, g.texture('EmissiveTexture', source.emissiveTexture).rgb);

  let rgb;
  if (source.disableLighting) {
    rgb = g.add('Unlit', diffuse, emissive);
  } else {
    const light = new BABYLON.LightBlock('Lights');
    g.worldPosition.connectTo(light.worldPosition);
    g.normalFrom(source.bumpTexture).connectTo(light.worldNormal);
    g.cameraPosition.connectTo(light.cameraPosition);
    diffuse.connectTo(light.diffuseColor);
    let specular = g.value('SpecularColor', source.specularColor);
    if (source.specularTexture) specular = g.multiply('Specular', specular, g.texture('SpecularTexture', source.specularTexture).rgb);
    specular.connectTo(light.specularColor);
    g.value('Glossiness', 1).connectTo(light.glossiness);
    g.value('SpecularPower', source.specularPower).connectTo(light.glossPower);
    if (light.view) g.view.connectTo(light.view);
    rgb = g.add('Lit', g.add('DiffuseAndSpecular', light.diffuseOutput, light.specularOutput), emissive);
  }

  if (source.ambientTexture) notes.push('ambient texture');
  if (source.reflectionTexture) notes.push('reflection texture');
  if (source.refractionTexture) notes.push('refraction texture');
  if (source.lightmapTexture) notes.push('lightmap');
  if (source.diffuseFresnelParameters || source.emissiveFresnelParameters || source.opacityFresnelParameters) notes.push('fresnel');
  return { rgb, alpha };
}

function buildPBR(BABYLON, source, g, notes) {
  const pbr = new BABYLON.PBRMetallicRoughnessBlock('PBR');
  g.worldPosition.connectTo(pbr.worldPosition);
  g.worldNormal.connectTo(pbr.worldNormal);
  g.view.connectTo(pbr.view);
  g.cameraPosition.connectTo(pbr.cameraPosition);
  if (source.bumpTexture) g.normalFrom(source.bumpTexture).connectTo(pbr.perturbedNormal);

  let baseColor = g.value('BaseColor', source.albedoColor);
  let alpha = g.value('Alpha', source.alpha);
  if (source.albedoTexture) {
    const tex = g.texture('AlbedoTexture', source.albedoTexture);
    baseColor = g.multiply('Albedo', baseColor, tex.rgb);
    if (source.albedoTexture.hasAlpha || source.useAlphaFromAlbedoTexture) alpha = g.multiply('AlbedoAlpha', alpha, tex.a);
  }
  if (source.opacityTexture) {
    const tex = g.texture('OpacityTexture', source.opacityTexture);
    alpha = g.multiply('Opacity', alpha, source.opacityTexture.getAlphaFromRGB ? tex.r : tex.a);
  }
  baseColor.connectTo(pbr.baseColor);

  // metallic/roughness null means the specular-glossiness workflow, which the block doesn't have.
  const specularWorkflow = source.metallic === null || source.metallic === undefined;
  if (specularWorkflow) notes.push('specular-glossiness workflow (approximated: metallic 0, roughness 1 - micro-surface)');
  let metallic = g.value('Metallic', source.metallic ?? 0);
  let roughness = g.value('Roughness', source.roughness ?? (specularWorkflow ? 1 - (source.microSurface ?? 1) : 1));
  let ambientOcclusion = null;
  if (source.metallicTexture) {
    const orm = g.texture('MetallicRoughnessTexture', source.metallicTexture);
    if (source.useRoughnessFromMetallicTextureGreen) roughness = g.multiply('RoughnessMap', roughness, orm.g);
    if (source.useMetallnessFromMetallicTextureBlue) metallic = g.multiply('MetallicMap', metallic, orm.b);
    if (source.useAmbientOcclusionFromMetallicTextureRed) ambientOcclusion = orm.r;
  }
  if (source.ambientTexture) ambientOcclusion = g.texture('AmbientOcclusionTexture', source.ambientTexture).r;
  metallic.connectTo(pbr.metallic);
  roughness.connectTo(pbr.roughness);
  if (ambientOcclusion) ambientOcclusion.connectTo(pbr.ambientOcc);
  alpha.connectTo(pbr.opacity);

  // Without a texture of its own the block reflects the scene's environment texture, like PBRMaterial.
  const reflection = new BABYLON.ReflectionBlock('Reflection');
  g.position.connectTo(reflection.position);
  g.world.connectTo(reflection.world);
  for (const [name, output] of [
    ['worldPosition', g.worldPosition],
    ['worldNormal', g.worldNormal],
    ['cameraPosition', g.cameraPosition],
    ['view', g.view],
  ]) {
    if (reflection.getInputByName(name)) g.connect(output, reflection, name);
  }
  if (source.reflectionTexture) reflection.texture = source.reflectionTexture;
  reflection.reflection.connectTo(pbr.reflection);

  let emissive = g.value('EmissiveColor', source.emissiveColor);
  if (source.emissiveTexture) emissive = g.multiply('Emissive', emissive, g.texture('EmissiveTexture', source.emissiveTexture).rgb);
  const rgb = g.add('Lit', pbr.lighting, emissive);

  if (source.clearCoat?.isEnabled) notes.push('clear coat');
  if (source.sheen?.isEnabled) notes.push('sheen');
  if (source.subSurface?.isRefractionEnabled || source.subSurface?.isTranslucencyEnabled) notes.push('sub-surface');
  if (source.anisotropy?.isEnabled) notes.push('anisotropy');
  if (source.iridescence?.isEnabled) notes.push('iridescence');
  if (source.lightmapTexture) notes.push('lightmap');
  if (source.reflectivityTexture || source.microSurfaceTexture) notes.push('reflectivity/micro-surface texture');
  return { rgb, alpha: pbr.alpha };
}

/** Class names this module can convert. */
const CONVERTIBLE = new Set(['StandardMaterial', 'PBRMaterial']);

/**
 * @returns {{ material: BABYLON.NodeMaterial, notes: string[] }} the built node material (not yet
 * assigned to anything) and the features of the source it does not reproduce.
 */
function createNodeMaterialFrom(BABYLON, source, scene = source.getScene()) {
  const className = source.getClassName();
  if (!CONVERTIBLE.has(className)) throw new Error(`Can't convert a ${className} to a node material.`);

  const notes = [];
  const material = new BABYLON.NodeMaterial(source.name, scene, { emitComments: false });
  const g = createGraph(BABYLON, source);
  const { rgb, alpha } = className === 'PBRMaterial' ? buildPBR(BABYLON, source, g, notes) : buildStandard(BABYLON, source, g, notes);

  const fragmentOutput = new BABYLON.FragmentOutputBlock('FragmentOutput');
  g.withFog(rgb, scene).connectTo(fragmentOutput.rgb);
  alpha.connectTo(fragmentOutput.a);

  material.addOutputNode(g.vertexOutput);
  material.addOutputNode(fragmentOutput);

  material.backFaceCulling = source.backFaceCulling;
  material.sideOrientation = source.sideOrientation;
  material.alphaMode = source.alphaMode;
  material.transparencyMode = source.transparencyMode;
  material.alphaCutOff = source.alphaCutOff ?? material.alphaCutOff;
  material.wireframe = source.wireframe;
  material.disableDepthWrite = source.disableDepthWrite;
  material.zOffset = source.zOffset;
  if (source.needDepthPrePass) material.needDepthPrePass = true;

  material.build(false);
  return { material, notes };
}

module.exports = { createNodeMaterialFrom, CONVERTIBLE };
