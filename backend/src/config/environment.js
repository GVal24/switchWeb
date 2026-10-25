const path = require('path');
const dotenv = require('dotenv');

const esRender =
  String(process.env.RENDER || '').toLowerCase() === 'true' ||
  Boolean(process.env.RENDER_SERVICE_ID);

if (!esRender) {
  dotenv.config({
    path: path.resolve(__dirname, '../../../.env'),
    override: false,
  });
}

module.exports = { esRender };
