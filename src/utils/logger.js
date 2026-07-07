// ============================================================
// src/utils/logger.js
// Minimal structured logger. No external dependency needed for
// a hackathon-scale service — keeps the dependency list honest.
// ============================================================
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

function ts() {
  return new Date().toISOString();
}

function make(scope) {
  const log = (level, ...args) => {
    if (LEVELS[level] > currentLevel) return;
    const prefix = `[${ts()}] [${level.toUpperCase()}] [${scope}]`;
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : console.log)(prefix, ...args);
  };
  return {
    error: (...a) => log('error', ...a),
    warn: (...a) => log('warn', ...a),
    info: (...a) => log('info', ...a),
    debug: (...a) => log('debug', ...a),
  };
}

export default make;
