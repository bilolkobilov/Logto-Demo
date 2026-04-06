const { spawn } = require('child_process');
const path = require('path');

const apps = [
    {
        name: 'Main App',
        script: 'app.js',
        dir: path.join(__dirname, 'main-app'),
        color: '\x1b[36m', // cyan
    },
    {
        name: 'App One',
        script: 'app-one.js',
        dir: path.join(__dirname, 'client-app'),
        color: '\x1b[35m', // magenta
    },
    {
        name: 'App Two',
        script: 'app-two.js',
        dir: path.join(__dirname, 'client-app'),
        color: '\x1b[33m', // yellow
    },
];

const reset = '\x1b[0m';
const bold = '\x1b[1m';

console.log(`\n${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
console.log(`${bold}  auth-hub — Starting all services${reset}`);
console.log(`${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);
console.log(`  \x1b[36mMain App\x1b[0m  →  http://localhost:3002`);
console.log(`  \x1b[35mApp One\x1b[0m   →  http://localhost:3000`);
console.log(`  \x1b[33mApp Two\x1b[0m   →  http://localhost:3001`);
console.log(`\n  Press ${bold}Ctrl+C${reset} to stop all.\n`);
console.log(`${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

apps.forEach(({ name, script, dir, color }) => {
    const proc = spawn('node', [script], { cwd: dir });

    proc.stdout.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            console.log(`${color}[${name}]${reset} ${line}`);
        });
    });

    proc.stderr.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            console.error(`${color}[${name}] \x1b[31mERR${reset} ${line}`);
        });
    });

    proc.on('close', (code) => {
        console.log(`${color}[${name}]${reset} exited with code ${code}`);
    });
});