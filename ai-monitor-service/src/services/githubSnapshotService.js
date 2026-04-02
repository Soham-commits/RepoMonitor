import { Octokit } from "@octokit/rest";

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function mapCommit(commit) {
  return {
    sha: commit.sha,
    message: commit.commit?.message?.split("\n")[0] ?? "",
    committedAt: toIsoDate(commit.commit?.committer?.date),
    author: commit.author?.login ?? commit.commit?.author?.name ?? "unknown",
    htmlUrl: commit.html_url,
  };
}

function mapContributor(contributor) {
  return {
    login: contributor.login ?? contributor.name ?? "anonymous",
    type: contributor.type ?? "Unknown",
    contributions: contributor.contributions ?? 0,
  };
}

function extractRootFiles(contentData) {
  if (!Array.isArray(contentData)) {
    return [];
  }

  return contentData.map((item) => ({
    name: item.name,
    type: item.type,
    path: item.path,
    size: item.size ?? null,
  }));
}

function computeCommitMetrics(commits, repoCreatedAt) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * oneDay;
  const thirtyDays = 30 * oneDay;

  let commitsIn24h = 0;
  let commitsIn7d = 0;
  let commitsIn30d = 0;
  let commitsInFirstHour = 0;

  const repoCreatedAtMs = repoCreatedAt ? Date.parse(repoCreatedAt) : null;

  const commitTimes = [];

  for (const commit of commits) {
    if (!commit.committedAt) {
      continue;
    }

    const committedAtMs = Date.parse(commit.committedAt);

    if (Number.isNaN(committedAtMs)) {
      continue;
    }

    commitTimes.push(committedAtMs);

    const delta = now - committedAtMs;

    if (delta <= oneDay) {
      commitsIn24h += 1;
    }

    if (delta <= sevenDays) {
      commitsIn7d += 1;
    }

    if (delta <= thirtyDays) {
      commitsIn30d += 1;
    }

    if (repoCreatedAtMs && committedAtMs - repoCreatedAtMs <= 60 * 60 * 1000) {
      commitsInFirstHour += 1;
    }
  }

  const intervalsMinutes = [];

  for (let index = 0; index < commitTimes.length - 1; index += 1) {
    const gap = Math.abs(commitTimes[index] - commitTimes[index + 1]) / 60000;
    intervalsMinutes.push(Number(gap.toFixed(2)));
  }

  return {
    commitsIn24h,
    commitsIn7d,
    commitsIn30d,
    commitsInFirstHour,
    averageMinutesBetweenCommits:
      intervalsMinutes.length > 0
        ? Number(
            (
              intervalsMinutes.reduce((sum, value) => sum + value, 0) /
              intervalsMinutes.length
            ).toFixed(2),
          )
        : null,
  };
}

function formatGitHubError(error) {
  return {
    message: error.message,
    status: error.status ?? null,
    documentationUrl: error.response?.data?.documentation_url ?? null,
  };
}

export class GitHubSnapshotService {
  constructor({ githubToken, recentCommitsLimit }) {
    this.recentCommitsLimit = recentCommitsLimit;
    this.octokit = new Octokit({ auth: githubToken });
  }

  async fetchSnapshots(teams) {
    const snapshots = await Promise.all(teams.map((team) => this.fetchTeamSnapshot(team)));

    return {
      collectedAt: new Date().toISOString(),
      teamCount: teams.length,
      snapshots,
    };
  }

  async fetchTeamSnapshot(team) {
    const snapshotAt = new Date().toISOString();

    try {
      const repoResponse = await this.octokit.repos.get({
        owner: team.owner,
        repo: team.repo,
      });

      const [commitsResult, contributorsResult, languagesResult, contentsResult] =
        await Promise.allSettled([
          this.octokit.repos.listCommits({
            owner: team.owner,
            repo: team.repo,
            per_page: this.recentCommitsLimit,
            sha: team.branch,
          }),
          this.octokit.repos.listContributors({
            owner: team.owner,
            repo: team.repo,
            per_page: 100,
            anon: "1",
          }),
          this.octokit.repos.listLanguages({
            owner: team.owner,
            repo: team.repo,
          }),
          this.octokit.repos.getContent({
            owner: team.owner,
            repo: team.repo,
            path: "",
          }),
        ]);

      const collectionErrors = [];

      const commits =
        commitsResult.status === "fulfilled"
          ? commitsResult.value.data.map(mapCommit)
          : (() => {
              collectionErrors.push({
                source: "commits",
                error: formatGitHubError(commitsResult.reason),
              });
              return [];
            })();

      const contributors =
        contributorsResult.status === "fulfilled"
          ? contributorsResult.value.data.map(mapContributor)
          : (() => {
              collectionErrors.push({
                source: "contributors",
                error: formatGitHubError(contributorsResult.reason),
              });
              return [];
            })();

      const languages =
        languagesResult.status === "fulfilled"
          ? languagesResult.value.data
          : (() => {
              collectionErrors.push({
                source: "languages",
                error: formatGitHubError(languagesResult.reason),
              });
              return {};
            })();

      const rootFiles =
        contentsResult.status === "fulfilled"
          ? extractRootFiles(contentsResult.value.data)
          : (() => {
              collectionErrors.push({
                source: "root_files",
                error: formatGitHubError(contentsResult.reason),
              });
              return [];
            })();

      const uniqueAuthors = new Set(
        commits.map((commit) => commit.author).filter((author) => author !== "unknown"),
      );

      const repoData = repoResponse.data;
      const metrics = computeCommitMetrics(commits, repoData.created_at);

      return {
        teamId: team.teamId,
        teamName: team.teamName,
        owner: team.owner,
        repo: team.repo,
        status: "ok",
        snapshotAt,
        repository: {
          fullName: repoData.full_name,
          htmlUrl: repoData.html_url,
          description: repoData.description,
          defaultBranch: repoData.default_branch,
          createdAt: toIsoDate(repoData.created_at),
          updatedAt: toIsoDate(repoData.updated_at),
          pushedAt: toIsoDate(repoData.pushed_at),
          sizeKb: repoData.size,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          openIssues: repoData.open_issues_count,
          isFork: repoData.fork,
          archived: repoData.archived,
          visibility: repoData.visibility,
        },
        metrics: {
          contributorCount: contributors.length,
          uniqueCommitAuthorCount: uniqueAuthors.size,
          ...metrics,
        },
        commits,
        contributors,
        languages,
        rootFiles,
        collectionErrors,
      };
    } catch (error) {
      return {
        teamId: team.teamId,
        teamName: team.teamName,
        owner: team.owner,
        repo: team.repo,
        status: "error",
        snapshotAt,
        error: formatGitHubError(error),
      };
    }
  }
}