const octokit = require('@octokit/rest')()
const puppeteer = require('puppeteer')

const config = require('./config')
const creds = require('./credentials')

/**
 * GReleaser.
 * @param {object} args - Arguments from the command line.
 */
async function greleaser (args) {
  const jiraProject = args.jiraProject
  const jiraVersion = args.jiraVersion
  const gitHubRepo = args.githubRepo
  const tag = args.tag
  let release = args.release
  const commit = args.commit

  console.log(`Getting Jira release notes for release version ${jiraVersion}.`)
  const jiraResults = await getJiraReleaseNotes(jiraProject, jiraVersion, tag)
  console.log(`Jira release notes for version ${jiraVersion} retrieved successfully.`)

  console.log(`Creating GitHub release ${jiraResults.tag} in repository ${gitHubRepo} for commit ${commit}.`)

  // Use the tag as the release name, if not supplied.
  if (!release) {
    release = tag
  }

  const gitHubResults = await createGitHubRelease(jiraResults.releaseText, gitHubRepo, release, jiraResults.tag, commit)
  console.log(`Release ${jiraVersion} created successfully: ${gitHubResults.data.html_url}`)
}

/**
 * Get release notes for a specific version from Jira.
 */
async function getJiraReleaseNotes (jiraProject, jiraVersion, tag) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.goto(`https://id.atlassian.com/login?continue=https%3A%2F%2F${config.jiraOrgName}.atlassian.net%2Flogin%3FredirectCount%3D1%26dest-url%3D%252Fsecure%252FReleaseNote.jspa%253FprojectId%253D${jiraProject}%2526version%253D${jiraVersion}`)

  const selectors = config.selectors

  // Login to Jira
  console.log('Logging into Jira.')
  await page.click(selectors.usernameSelector)
  await page.keyboard.type(creds.jiraUsername)
  await page.click(selectors.buttonSelector)

  // Annoyingly wait for the password input to appear
  await page.waitFor(500)
  await page.click(selectors.passwordSelector)
  await page.keyboard.type(creds.jiraPassword)
  await page.click(selectors.buttonSelector)

  console.log('Loading release notes.')
  await page.waitForNavigation()

  // Get the release notes for the selected version
  await page.waitForSelector(selectors.releaseNotesSelector)
  const releaseText = await page.evaluate(() => document.querySelector('#editcopy').textContent)

  // Get the release information from the release text
  const tagRegex = /.*Release notes - .* - Version\s*([^\n]*)/
  const regexResult = releaseText.match(tagRegex)

  if (!tag) {
    const releaseInformation = regexResult[1].split(' ')
    tag = releaseInformation[releaseInformation.length - 1]
  }

  browser.close()

  return {
    releaseText,
    tag
  }
}

/**
 * Create a new release on GitHub.
 * @param {String} releaseText - The text to include in the body of the release.
 * @param {String} gitHubRepo - The name of the repo for this release.
 * @param {String} release - The name to use for the release.
 * @param {String} tag - The tag to use for the release.
 * @param {String} commit - The commit to tag for this release.
 */
async function createGitHubRelease (releaseText, gitHubRepo, release, tag, commit) {
  try {
    octokit.authenticate({
      type: 'basic',
      username: creds.gitHubUsername,
      password: creds.gitHubPassword
    })
  } catch (error) {
    console.error(`There was an error authentication with GitHub. ${error}`)
    process.exit(1)
  }

  try {
    const result = await octokit.repos.createRelease({
      owner: config.gitHubOwner,
      repo: gitHubRepo,
      tag_name: tag,
      name: release,
      body: releaseText,
      target_commitish: commit
    })

    return result
  } catch (error) {
    console.error(`There was an error creating the release in GitHub. ${error}`)
    process.exit(1)
  }
}

module.exports = greleaser
