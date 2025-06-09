// scripts/generate-theme-manifest.mjs
import fs from 'fs/promises';
import path from 'path';

const themesBaseDir = path.join(process.cwd(), 'public', 'themes');

// A function to process a single directory (core or contrib)
async function processThemeDirectory(subDir) {
  const fullDir = path.join(themesBaseDir, subDir);
  const outputFile = path.join(fullDir, 'themes.json');
  const themeManifest = [];

  try {
    const themeFolders = await fs.readdir(fullDir, { withFileTypes: true });

    for (const entry of themeFolders) {
      if (entry.isDirectory()) {
        const themeId = entry.name;
        const themeJsonPath = path.join(fullDir, themeId, 'theme.json');
        
        try {
          const themeJsonContent = await fs.readFile(themeJsonPath, 'utf-8');
          const themeData = JSON.parse(themeJsonContent);
          
          if (themeData.name) {
            themeManifest.push({
              id: themeId,
              name: themeData.name,
            });
            console.log(`- Found ${subDir} theme: ${themeData.name} (id: ${themeId})`);
          } else {
             console.warn(`! Warning: Theme "${themeId}" in '${subDir}' is missing a "name".`);
          }
        } catch {
           console.warn(`! Warning: Could not read theme.json for "${themeId}" in '${subDir}'.`);
        }
      }
    }

    themeManifest.sort((a, b) => a.name.localeCompare(b.name));
    await fs.writeFile(outputFile, JSON.stringify(themeManifest, null, 2));
    console.log(`✅ Generated manifest for '${subDir}' themes.`);

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`- Directory 'public/themes/${subDir}' not found, skipping.`);
      // Ensure the directory exists so we can write an empty file
      await fs.mkdir(fullDir, { recursive: true });
      await fs.writeFile(outputFile, '[]');
    } else {
      console.error(`❌ Error processing '${subDir}' directory:`, error);
    }
  }
}

async function generateAllManifests() {
    console.log('Scanning for themes...');
    await processThemeDirectory('core');
    await processThemeDirectory('contrib');
}

generateAllManifests();