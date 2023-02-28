#!/bin/bash
npm run run-test
status1=$?
npx tsc --noEmit
status2=$?
if [ $status1 -eq 0 ] && [ $status2 -eq 0 ]
then
  echo "Both commands succeeded"
  exit 0
else
  echo "At least one command failed"
  exit 1
fi