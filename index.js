import fs from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { homedir } from 'os';

const handler = (path) => {
  process.chdir(join(homedir(), 'acme'));
  fs.readdirSync(path, { withFileTypes: true })
    .filter(file => file.isDirectory())
    .map(dir => {
      return {
        dirName: dir.name,
        domain: JSON.parse(fs.readFileSync(join(path, dir.name, 'renew.json'))).domains
      };
    })
    .forEach(entry => {
      console.log(`Updating ${entry.domain} in directory ${entry.dirName}`);
      const acme = spawnSync('./acme.sh', [
        '--issue',
        '-d', entry.domain,
        '--dns', 'dns_aws',
        '--certpath', join(path, entry.dirName, 'cert.pem'),
        '--keypath', join(path, entry.dirName, 'privkey.pem'),
        '--fullchainpath', join(path, entry.dirName, 'fullchain.pem'),
        '--capath', join(path, entry.dirName, 'chain.pem'),
        '--reloadcmd', 'sudo synoservice --restart nginx; sudo synoservice --restart nmbd; sudo synoservice --restart avahi'
      ]);
      console.log( `stderr: ${acme.stderr}` );
      console.log( `stdout: ${acme.stdout}` );
    });
}

handler('/usr/syno/etc/certificate/_archive');