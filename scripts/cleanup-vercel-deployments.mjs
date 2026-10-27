import { pathToFileURL } from "node:url";

const API_BASE_URL = "https://api.vercel.com";
const PAGE_SIZE = 100;
const STAGING_BRANCH = "staging";
const STAGING_DEPLOYMENTS_TO_KEEP = 2;

function getBranch(deployment) {
  const metadata = deployment.meta ?? {};
  const branch = [
    metadata.gitlabCommitRef,
    metadata.githubCommitRef,
    metadata.bitbucketCommitRef,
    metadata.gitCommitRef,
    metadata.gitBranch,
    deployment.branch,
  ].find((value) => typeof value === "string" && value.trim());

  return branch?.trim() ?? null;
}

function getCreatedAt(deployment) {
  const timestamp = Number(deployment.createdAt ?? deployment.created);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function includesAlias(deployment, alias) {
  const aliases = [...(deployment.alias ?? []), ...(deployment.aliases ?? [])];
  return aliases.some((value) => {
    const hostname = typeof value === "string" ? value : value?.domain;
    return typeof hostname === "string" && hostname.toLowerCase() === alias;
  });
}

export function planCleanup(deployments, productionAlias) {
  const staging = deployments
    .filter((deployment) => getBranch(deployment) === STAGING_BRANCH)
    .sort((left, right) => getCreatedAt(right) - getCreatedAt(left));
  const retainedStagingIds = new Set(
    staging.slice(0, STAGING_DEPLOYMENTS_TO_KEEP).map((deployment) => deployment.uid),
  );
  const toDelete = [];
  const skipped = [];

  for (const deployment of deployments) {
    const branch = getBranch(deployment);
    if (branch === null) {
      skipped.push(deployment);
      continue;
    }

    if (branch === STAGING_BRANCH && retainedStagingIds.has(deployment.uid)) {
      continue;
    }

    if (includesAlias(deployment, productionAlias)) {
      console.warn(`Keeping ${deployment.uid}: it currently serves ${productionAlias}.`);
      continue;
    }

    toDelete.push(deployment);
  }

  return { toDelete, skipped, retainedStaging: staging.slice(0, STAGING_DEPLOYMENTS_TO_KEEP) };
}

async function request(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Vercel API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function listDeployments({ projectId, teamId, token }) {
  const deployments = new Map();
  let until;

  while (true) {
    const query = new URLSearchParams({ projectId, teamId, limit: String(PAGE_SIZE) });
    if (until) query.set("until", until);

    const page = await request(`/v7/deployments?${query}`, token);
    for (const deployment of page.deployments) {
      deployments.set(deployment.uid, deployment);
    }

    const next = page.pagination?.next;
    if (!next || next === until || page.deployments.length === 0) break;
    until = String(next);
  }

  return Array.from(deployments.values());
}

async function deleteDeployment(deploymentId, teamId, token) {
  const query = new URLSearchParams({ teamId });
  const response = await fetch(`${API_BASE_URL}/v13/deployments/${encodeURIComponent(deploymentId)}?${query}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Could not delete Vercel deployment ${deploymentId}: ${response.status} ${await response.text()}`);
  }
  console.log(`Deleted Vercel deployment ${deploymentId}.`);
}

async function main() {
  const { VERCEL_TOKEN: token, VERCEL_PROJECT_ID: projectId, VERCEL_ORG_ID: teamId } = process.env;
  if (!token || !projectId || !teamId) {
    throw new Error("VERCEL_TOKEN, VERCEL_PROJECT_ID, and VERCEL_ORG_ID are required.");
  }
  if (process.env.CI_COMMIT_BRANCH !== STAGING_BRANCH) {
    throw new Error("Deployment cleanup can only run for the staging branch.");
  }

  const configuredAlias = process.env.VERCEL_PRODUCTION_URL ?? "qurraojos.vercel.app";
  const productionAlias = new URL(
    configuredAlias.includes("://") ? configuredAlias : `https://${configuredAlias}`,
  ).hostname.toLowerCase();
  const deployments = await listDeployments({ projectId, teamId, token });
  const { toDelete, skipped, retainedStaging } = planCleanup(deployments, productionAlias);

  console.log(`Keeping ${retainedStaging.length} newest staging deployment(s).`);
  for (const deployment of retainedStaging) {
    console.log(`Keeping staging deployment ${deployment.uid}.`);
  }
  for (const deployment of skipped) {
    console.warn(`Skipping ${deployment.uid}: Vercel did not provide a branch reference.`);
  }
  for (const deployment of toDelete) {
    await deleteDeployment(deployment.uid, teamId, token);
  }
  console.log(`Deployment cleanup complete; removed ${toDelete.length} deployment(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
