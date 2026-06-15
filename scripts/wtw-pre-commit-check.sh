#!/bin/bash
# WTW PRE-COMMIT CHECK — run before every commit
# Usage: bash scripts/wtw-pre-commit-check.sh

echo "=============================="
echo "WTW PRE-COMMIT SAFETY CHECK"
echo "=============================="

echo ""
echo "Files staged for commit:"
git diff --cached --name-only

echo ""
echo "Checking for locked files in staged changes:"
LOCKED=$(git diff --cached --name-only | grep -E \
"supabase-client\.js|supabase-config\.js|\.sql$|\.patch$|\
admin\.html|partner-dashboard\.html|confirmation\.html|\
qr-checkin\.html|admin-login\.html|partner-login\.html|\
reservation-submitted\.html|deploy.*\.yml")

if [ -n "$LOCKED" ]; then
  echo "WARNING — LOCKED FILES DETECTED:"
  echo "$LOCKED"
  echo "Stop and check with Claude before committing."
else
  echo "No locked files in staged changes. Safe to proceed."
fi

echo ""
echo "Whitespace errors:"
git diff --cached --check

echo ""
echo "Diff stat:"
git diff --cached --stat

echo ""
echo "=============================="
echo "CHECK COMPLETE"
echo "=============================="
