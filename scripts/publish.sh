#!/usr/bin/env bash
# The ONLY way any session pushes to main. Rebases onto the newest origin/main, runs the protection checks,
# pushes WITHOUT force and retries when another session pushed first.
#
#   1. commit your work first (git add <only the files you changed>; git commit)
#   2. bash scripts/publish.sh
#
# Never uses --force, --force-with-lease or reset --hard. Contains no secrets.
set -u
cd "$(dirname "$0")/.."
BRANCH=main
MAX_TRIES=3
RULE="RULE: never overwrite files you did not intend to change; integrate both changes (keep the protected security/tracking feature AND your change)."

die() { echo; echo "publish.sh STOPPED: $*" >&2; exit 1; }

# the checks that must pass on the exact tree that gets pushed
run_checks() {
  echo "== inject-gtm"
  node scripts/inject-gtm.js || return 1
  if [ -n "$(git status --porcelain)" ]; then
    echo "inject-gtm changed files (or the tree is dirty). Commit them, then run publish.sh again:" >&2
    git status --short >&2
    return 2
  fi
  echo "== guard"
  node scripts/guard.js || return 1
  echo "== lead tests"
  node tools/test-lead.js | tail -3 || return 1
  if [ -f tools/verify-protected.js ]; then
    echo "== verify-protected"
    node tools/verify-protected.js || return 1
  fi
  if [ -f tools/test-attribution.js ]; then
    if node -e "try{require('playwright')}catch(e){require('/opt/node-tools/node_modules/playwright')}" 2>/dev/null; then
      echo "== attribution browser test (local static server)"
      PORT=$((8800 + RANDOM % 150))
      python3 -m http.server "$PORT" >/dev/null 2>&1 &
      SRV=$!
      sleep 1
      node tools/test-attribution.js "http://127.0.0.1:$PORT" | tail -3
      rc=${PIPESTATUS[0]}
      kill "$SRV" 2>/dev/null
      [ "$rc" -eq 0 ] || return 1
    else
      echo "== attribution browser test SKIPPED: Playwright is not available here (guard + lead tests still ran)"
    fi
  fi
  return 0
}

rebase_onto_main() {
  git fetch origin "$BRANCH" || die "git fetch failed"
  if ! git rebase "origin/$BRANCH"; then
    echo >&2
    echo "REBASE CONFLICT in:" >&2
    git diff --name-only --diff-filter=U >&2
    echo >&2
    echo "$RULE" >&2
    echo "Open each file, keep BOTH sides, then: git add <file> && git rebase --continue && bash scripts/publish.sh" >&2
    echo "(protected files - api/lead.js, aim-track.js, privacy-policy.html, vercel.json, scripts/guard.js, CLAUDE.md - the protected version wins any real conflict.)" >&2
    echo "To give up safely: git rebase --abort (your commits stay untouched). Do NOT force-push." >&2
    exit 1
  fi
}

# --- 0. refuse dangerous input
for a in "$@"; do case "$a" in *force*|*reset*) die "force/reset options are not allowed";; esac; done
git rev-parse --git-dir >/dev/null 2>&1 || die "not a git repository"

# --- 1/2. clean tree required (everything must be in the intended commit)
git fetch origin "$BRANCH" || die "git fetch failed"
if [ -n "$(git status --porcelain)" ]; then
  git status --short >&2
  die "uncommitted changes. Commit exactly the files you intended to change (git add <files>; git commit), then run again."
fi
[ -n "$(git log origin/$BRANCH..HEAD --oneline)" ] || echo "note: nothing ahead of origin/$BRANCH (the checks still run)."

# --- 3. rebase, 4. checks, 5. push (retry when someone else pushed first)
try=1
while [ "$try" -le "$MAX_TRIES" ]; do
  echo "=== attempt $try of $MAX_TRIES"
  rebase_onto_main
  run_checks; rc=$?
  [ "$rc" -eq 0 ] || die "checks failed (see above). Fix the cause; never loosen or skip a check. Nothing was pushed."
  if git push origin "HEAD:$BRANCH"; then
    sha=$(git rev-parse --short HEAD)
    echo
    echo "PUSHED $sha to origin/$BRANCH."
    echo "NEXT (required):"
    echo "  1. wait until the Vercel PRODUCTION deployment of $sha is READY (if it ERRORs because of the guard, read the build log and FIX FORWARD with a new commit)"
    echo "  2. confirm aiinmarketing.in and www.aiinmarketing.in are aliased to that deployment"
    echo "  3. run: node scripts/live-check.js     (must print LIVE CHECK OK)"
    echo "  Never redeploy an older deployment from Vercel: it drops newer features. Roll forward with a new commit."
    exit 0
  fi
  echo "push rejected (another session pushed first or the network failed); fetching, rebasing and re-checking..."
  try=$((try + 1))
  sleep $((try * 2))
done
die "could not push after $MAX_TRIES attempts. Run the script again; never use --force."
