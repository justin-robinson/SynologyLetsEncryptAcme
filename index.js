import fs from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { homedir } from 'os';

const handler = (path) => {
  process.chdir(join(homedir(), 'acme.sh'));
  fs.readdirSync(path, { withFileTypes: true })
    .filter(file => file.isDirectory())
    .map(dir => {
      return {
        dirName: dir.name,
        domain: JSON.parse(fs.readFileSync(join(path, dir.name, 'renew.json'))).domains
      };
    })
    .forEach(({domain, dirName}) => {
      console.log(`Updating ${domain} in directory ${dirName}`);
      const reverseProxyFolder = findReverseProxyFolder(domain);
      const command = ('./acme.sh');
      const issueArgs = createCertArgs(join(path, dirName));
      const installArgs = createCertArgs(reverseProxyFolder);
      const reloadCommands = [
        `(cd ${join(homedir(), 'acme.sh')}`,
        `./acme.sh --install-cert -d ${domain} ${installArgs.join(' ')}`,
        'sudo synoservice --restart nginx',
        'sudo synoservice --restart nmbd',
        'sudo synoservice --restart avahi)'
      ];
      const commandArgs = [
        '--issue',
        '-d', domain,
        '--dns', 'dns_aws',
        ...issueArgs,
        '--reloadcmd', reloadCommands.join('; ')
      ];
      console.log(`running command ${command} ${commandArgs.join(' ')}`);
      const acme = spawnSync(command, commandArgs);
      console.log( `stderr: ${acme.stderr}` );
      console.log( `stdout: ${acme.stdout}` );
    });
}

const findReverseProxyFolder = (domainToFind) => {
  const path = '/usr/syno/etc/certificate/ReverseProxy';
  const folders = fs.readdirSync(path, {withFileTypes: true})
    .filter(file => file.isDirectory())
    .map(dir => {
      const command = 'openssl';
      const args = [
        'x509',
        '-in', `${join(path, dir.name, 'cert.pem')}`,
        '-text',
        '-noout',
      ];
      const certText = spawnSync(command, args);
      const domainName = certText.stdout.toString()
                                        .split(/\n/)
                                        .filter(line => line.trim().startsWith('DNS:'))
                                        .map(dnsLine => dnsLine.split(':')[1]);
      return {
        dirName: dir.name,
        domain: domainName.length ? domainName[0] : null
      }
    })
    .filter(({domain}) => {
      return domain === domainToFind;
    })
    .map(({dirName}) => {
      return dirName;
    });

  return folders.length ? join(path, folders[0]) : "";
}

const createCertArgs = (folder) => {
  return [
    '--certpath', join(folder, 'cert.pem'),
    '--keypath', join(folder, 'privkey.pem'),
    '--fullchainpath', join(folder, 'fullchain.pem'),
    '--capath', join(folder, 'chain.pem')
  ]
}

handler('/usr/syno/etc/certificate/_archive');
