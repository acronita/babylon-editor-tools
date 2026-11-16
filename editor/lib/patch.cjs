// Method patches on the editor's classes that undo cleanly when the plugin closes or reloads.

/**
 * Replaces `target[name]` with `wrap(original)` and returns a function that restores it.
 * The replacement is only removed if nobody patched over it since.
 */
function patchMethod(target, name, wrap) {
  const original = target[name];
  if (typeof original !== 'function') throw new Error(`Cannot patch ${name}: not a function.`);
  const patched = wrap(original);
  target[name] = patched;
  return () => {
    if (target[name] === patched) target[name] = original;
  };
}

module.exports = { patchMethod };
