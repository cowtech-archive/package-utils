#!/usr/bin/env node

/*
 * This file is part of the package-utils package. Copyright (C) 2017 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

const fs = require('fs');
const cli = require('commander');
const semver = require('semver');
const childProcess = require('child_process');

const parseVersion = function(version){
  if(version.match(/^\d/))
    return version;

  return semver.inc(require('./package.json').version, version);
};

const loadChangelog = function(){
  const raw = fs.readFileSync('./CHANGELOG.md', 'utf8').trim();

  return raw.split('\n').reduce((accu, line) => {
    line = line.trim();

    if(line.startsWith('###')) // New version
      accu.unshift([line.substring(4), []]);
    else if(line.startsWith('* ')) // Entry item
      accu[0][1].push(line.substring(2));

    return accu;
  }, []).reverse();
};

const saveChangelog = function(changelog){
  // Format file for printing
  const raw = changelog.map(([version, entries]) => {
    const rawEntries = entries.map(e => `* ${e}`).join('\n');

    return `### ${version}\n\n${rawEntries}\n`;
  }).join('\n');

  // Write the file and commit the repository.
  fs.writeFileSync('./CHANGELOG.md', raw, 'utf8');
  childProcess.execSync('git commit -a -m "Updated CHANGELOG.md."', {stdio: 'inherit'});

  return raw;
};

const actionChangelog = function(messages, command){
  const changelog = loadChangelog();

  if(command.version) // If needed, create a new version
    changelog.unshift([`${parseVersion(command.version)} / ${new Date().toISOString().substring(0, 10)}`, []]);

  // Add new entries
  changelog[0][1].unshift(...messages);

  // Save the file
  saveChangelog(changelog);
};

const actionRelease = function(version, messages, command){
  if(messages.length)
    actionChangelog(messages, {version});

  childProcess.execSync(`npm version ${version}`);

  if(!command.noPublish){
    childProcess.execSync(
      `npm publish --access ${command.restricted ? 'restricted' : 'public'}`,
      {stdio: 'inherit', env: {HOME: process.env.HOME, PATH: process.env.PATH}}
    );
  }
};

cli
  .description('Small utility to manage npm package releases.')
  .usage('package-utils COMMAND [ARGS...]');

cli.command('changelog [messages...]').alias('c')
  .option('-v,--version <VERSION>', 'A new version to start. Support increments like in "npm version".', false)
  .description('Inserts a new entry in the CHANGELOG.md file.')
  .action(actionChangelog);

cli.command('release <version> [messages...]').alias('r')
  .option('-n,--no-publish', 'Do not publish the package but just tag the version.')
  .option('-r,--restricted', 'If the package must be published as restricted.')
  .description('Releases a new version.')
  .action(actionRelease);

cli.parse(process.argv);
