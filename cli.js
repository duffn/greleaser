#!/usr/bin/env node

const greleaser = require('./greleaser')
const args = require('yargs')
  .usage('Usage: $0 [options]')
  .command('[options]', 'Release a Jira version to GitHub.')
  .option('p', {
    description: 'The Jira project ID that contains the version for release.',
    alias: 'jira-project',
    type: 'string'
  })
  .option('j', {
    description: 'The Jira version ID to use for the release.',
    alias: 'jira-version',
    type: 'string'
  })
  .option('g', {
    description: 'The GitHub repository in which the release will be created.',
    alias: 'github-repo',
    type: 'string'
  })
  .option('c', {
    description: 'The commit to tag for this release.',
    alias: 'commit',
    type: 'string',
    default: 'master'
  })
  .option('t', {
    description: 'The tag name to use in GitHub. If not supplied, it will be extracted from the Jira version name.',
    alias: 'tag',
    type: 'string'
  })
  .option('r', {
    description: 'The release name to use in GitHub. If not supplied the tag name will be used as the release name.',
    alias: 'release',
    type: 'string'
  })
  .demandOption(['j', 'g', 'p'])
  .help('h')
  .alias('h', 'help')
  .argv

greleaser(args)
