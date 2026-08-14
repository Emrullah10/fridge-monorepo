const log = {
  info: (message, meta = {}) => console.log(JSON.stringify({ level: 'info', message, ...meta })),
  warn: (message, meta = {}) => console.warn(JSON.stringify({ level: 'warn', message, ...meta })),
  error: (message, meta = {}) => console.error(JSON.stringify({ level: 'error', message, ...meta })),
};

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const makeSystemClock = () => ({
  now: () => new Date(),
});

export { log, asyncHandler, makeSystemClock };
