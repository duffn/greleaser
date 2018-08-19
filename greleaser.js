const octokit = require('@octokit/rest')()
const ora = require('ora')
const puppeteer = require('puppeteer')

const config = require('./config')

/**
 * GReleaser.
 * @param {object} args - Arguments from the command line.
 */
async function greleaser (args) {
  const env = process.env
  if (!env.JIRA_USERNAME || !env.JIRA_PASSWORD || !env.JIRA_ORG_NAME || !env.GITHUB_USERNAME || !env.GITHUB_PASSWORD || !env.GITHUB_ORG_NAME) {
    console.error('You must set the JIRA_USERNAME, JIRA_PASSWORD, JIRA_ORG_NAME, GITHUB_USERNAME, GITHUB_PASSWORD and GITHUB_ORG_NAME environment variables.')
    process.exit(1)
  }

  const jiraProject = args.jiraProject
  const jiraVersion = args.jiraVersion
  const gitHubRepo = args.githubRepo
  const tag = args.tag
  let release = args.release
  const commit = args.commit

  const jiraResults = await getJiraReleaseNotes(jiraProject, jiraVersion, tag)

  // Use the tag as the release name, if not supplied.
  if (!release) {
    release = tag
  }

  await createGitHubRelease(jiraResults.releaseText, gitHubRepo, release, jiraResults.tag, commit)
}

/**
 * Get release notes for a specific version from Jira.
 */
async function getJiraReleaseNotes (jiraProject, jiraVersion, tag) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.goto(`https://id.atlassian.com/login?continue=https%3A%2F%2F${process.env.JIRA_ORG_NAME}.atlassian.net%2Flogin%3FredirectCount%3D1%26dest-url%3D%252Fsecure%252FReleaseNote.jspa%253FprojectId%253D${jiraProject}%2526version%253D${jiraVersion}`)

  const selectors = config.selectors

  // Login to Jira
  const spinner = ora('Logging into Jira.').start()
  await page.click(selectors.usernameSelector)
  await page.keyboard.type(process.env.JIRA_USERNAME)
  await page.click(selectors.buttonSelector)

  // Annoyingly wait for the password input to appear
  await page.waitFor(500)
  await page.click(selectors.passwordSelector)
  await page.keyboard.type(process.env.JIRA_PASSWORD)
  await page.click(selectors.buttonSelector)

  spinner.succeed()

  spinner.text = `Loading release notes for version ${jiraVersion}.`
  spinner.start()
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

  spinner.succeed()

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
      username: process.env.GITHUB_USERNAME,
      password: process.env.GITHUB_PASSWORD
    })
  } catch (error) {
    console.error(`There was an error authentication with GitHub. ${error}`)
    process.exit(1)
  }

  const spinner = ora(`Creating GitHub release ${tag} in repository ${gitHubRepo} on commit ${commit}.`).start()
  try {
    const result = await octokit.repos.createRelease({
      owner: process.env.GITHUB_ORG_NAME,
      repo: gitHubRepo,
      tag_name: tag,
      name: release,
      body: releaseText,
      target_commitish: commit
    })

    spinner.succeed()
    console.log(`Release URL: ${result.data.html_url}`)
    return result
  } catch (error) {
    spinner.fail()
    console.error(`There was an error creating the release in GitHub. ${error}`)
    process.exit(1)
  }
}

module.exports = greleaser
