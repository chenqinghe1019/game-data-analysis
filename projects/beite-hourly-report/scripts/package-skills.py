"""Compatibility entry: deterministic repository build; local install is explicit."""
from pathlib import Path
import argparse
import subprocess
import sys

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install',action='store_true',help='Also update the local beite-hourly-report skill')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    command = [sys.executable,str(root/'scripts/repo-maintenance.py'),'build']
    if args.install:
        command += ['--install','beite-hourly-report']
    return subprocess.call(command,cwd=root)

if __name__=='__main__':
    raise SystemExit(main())
