/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {promisify} from 'util';
import {exec as execCb} from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {PackageJson} from '@lit-labs/analyzer/lib/model.js';

const exec = promisify(execCb);

/**
 * Map npm package name to folder in monorepo to use instead
 */
export interface MonorepoPackages {
  [index: string]: string;
}

/**
 * npm installs the package in the given packageRoot, optionally using monorepo
 * packages in place of installing from the registry.
 *
 * Note that rather than using an `npm link` / symlink approach for substituting
 * monorepo packages, we use `npm pack` and point package.json to the tarball
 * for that package. This more closely matches how a given test package will be
 * installed  from the registry, and avoids issues when a monorepo has
 * peerDependencies (since a monorepo package will have its own copy of its
 * peerDependencies installed, which is not what will happen when installed
 * as a dependency itself).
 *
 * @param packageRoot
 * @param linkedPackages
 */
export const installPackage = async (
  packageRoot: string,
  monorepoPackages?: MonorepoPackages
) => {
  // Read package.json
  const packageFile = path.join(packageRoot, 'package.json');
  const packageText = await fs.readFile(packageFile, 'utf8');
  const packageJson = JSON.parse(packageText) as PackageJson;
  if (monorepoPackages !== undefined) {
    let deps;
    for (const [pkg, folder] of Object.entries(monorepoPackages)) {
      // Figure out what kind of dep the linked dep is
      if (packageJson.dependencies?.[pkg] !== undefined) {
        deps = packageJson.dependencies;
      } else if (packageJson.devDependencies?.[pkg] !== undefined) {
        deps = packageJson.devDependencies;
      } else if (packageJson.peerDependencies?.[pkg] !== undefined) {
        deps = packageJson.peerDependencies;
      } else {
        throw new Error(
          `Linked package '${pkg}' was not a dependency of '${packageFile}'.`
        );
      }
      // Make sure the folder for the package to link exists
      try {
        await fs.access(folder);
      } catch {
        throw new Error(
          `Folder ${folder} for linked package '${pkg}' did not exist.`
        );
      }
      // npm pack the linked package into a tarball
      try {
        const {stdout: tarballFile} = await exec('npm pack', {cwd: folder});
        const tarballPath = `file:${path.relative(
          packageRoot,
          path.join(folder, tarballFile.trim())
        )}`;
        // Update the package.json dep with a file path to the tarball
        deps[pkg] = tarballPath;
      } catch (e) {
        throw new Error(`Error generating tarball for '${pkg}': ${e}`);
      }
    }
    // Write out the updated package.json
    await fs.writeFile(
      packageFile,
      JSON.stringify(packageJson, null, 2),
      'utf8'
    );
  }
  // Install
  await exec('npm install', {cwd: packageRoot});
  // Restore package.json
  await fs.writeFile(packageFile, packageText, 'utf8');
};

export const buildPackage = async (packageRoot: string) => {
  try {
    await exec('npm run build', {cwd: packageRoot});
  } catch (e) {
    const {stdout} = e as {stdout: string};
    throw new Error(`Failed to build package '${packageRoot}': ${stdout}`);
  }
};
