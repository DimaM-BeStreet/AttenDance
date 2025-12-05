const { spawn } = require('child_process');

// Function to run a command
function runCommand(command, args, name) {
  const child = spawn(command, args, { stdio: 'inherit', shell: true });

  child.on('error', (error) => {
    console.error(`[${name}] Error: ${error.message}`);
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.log(`[${name}] Process exited with code ${code}`);
    }
  });

  return child;
}

console.log('Starting development environment...');

// Start Webpack in watch mode
runCommand('npm', ['run', 'dev'], 'Webpack');

// Start Firebase Emulators (Hosting only for speed, add others if needed)
// We wait a bit to let webpack do initial build, though not strictly necessary as they run in parallel
setTimeout(() => {
    runCommand('firebase', ['emulators:start', '--only', 'hosting'], 'Firebase');
}, 2000);
