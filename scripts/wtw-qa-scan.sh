#!/bin/bash
# WTW QA SCAN — run before every loop
# Usage: bash scripts/wtw-qa-scan.sh

echo "=============================="
echo "WTW SITE QA SCAN"
echo "=============================="

echo ""
echo "--- EXTERNAL IMAGE RISK ---"
echo "Lovable.app refs (must be 0):"
grep -roh "lovable.app" --include="*.html" . | wc -l

echo ""
echo "Unsplash refs (informational):"
grep -roh "unsplash.com" --include="*.html" . | wc -l

echo ""
echo "--- CONTENT TRUST RISKS ---"
echo "Verified language:"
grep -rohE "Verified[^<\"]{0,30}|verified [a-z ]{3,20}|every venue verified|every entry confirmed|confirmed before you arrive" --include="*.html" . | sort | uniq -c | sort -rn

echo ""
echo "SELLING FAST / limited status:"
grep -roh "SELLING FAST\|status:'limited'\|status:\"limited\"" --include="*.html" . | wc -l

echo ""
echo "Fictional venue names:"
grep -roh "Maison Mercer\|Hudson Glass\|Tribeca Salon" --include="*.html" . | sort | uniq -c

echo ""
echo "Real venue names (confirm agreements exist):"
grep -roh "Marquee\|Zero Bond\|Tao Downtown\|Lavo\|Cipriani\|PH-D\|Dumbo House\|Public Arts\|Somewhere Nowhere\|The Nines" --include="*.html" . | sort | uniq -c

echo ""
echo "--- DEAD CTAs ---"
echo "Get The App (must be 0 on public pages):"
grep -rl "Get The App" --include="*.html" . | grep -vE "admin|partner|confirmation|qr"

echo ""
echo "--- REPO HYGIENE ---"
echo "Patch files in root (must be 0):"
ls *.patch 2>/dev/null | wc -l

echo ""
echo "SQL files in root (must be 0):"
ls *.sql 2>/dev/null | wc -l

echo ""
echo "--- LOCKED FILE INTEGRITY ---"
echo "supabase-client.js last modified:"
git log -1 --format="%h %s (%cr)" -- supabase-client.js

echo ""
echo "--- DIFF STATE ---"
git status --short
git diff --check

echo ""
echo "=============================="
echo "SCAN COMPLETE"
echo "=============================="
