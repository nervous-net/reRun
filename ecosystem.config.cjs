// ABOUTME: PM2 process manager configuration for reRun
// ABOUTME: Auto-starts the server on boot, restarts on crash

module.exports = {
  apps: [{
    name: 'rerun',
    script: 'dist/server/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 1987,
    },
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
