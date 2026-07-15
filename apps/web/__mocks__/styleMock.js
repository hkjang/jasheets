const styles = new Proxy({}, {
  get: (_target, property) => String(property),
});

module.exports = { __esModule: true, default: styles };
