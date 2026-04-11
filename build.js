const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pkg = require('./package.json');

const type = process.argv[2]; 
if (!['core', 'pro'].includes(type)) {
    console.error("Please specify build type: 'core' or 'pro'");
    process.exit(1);
}

const isPro = type === 'pro';
console.log(`\n🚀 STARTING TRANSPARENT BUILD: SmartClip ${type.toUpperCase()}...\n`);

const filesToMod = ['main.js', 'licenseManager.js'];
const staticFiles = ['mint-icon.ico']; 
const targetLineRegex = /let\s+IS_PRO_BUILD\s*=\s*(true|false)\s*;/g;
const newLine = `let IS_PRO_BUILD = ${isPro};`;

const config = isPro ? {
    name: "SmartClip Pro",
    id: "com.mintlogic.smartclip",
    exe: "SmartClip",
    artifact: "SmartClip Pro Setup \${version}.\${ext}",
    shortcut: "SmartClip",
    uninstall: "SmartClip"
} : {
    name: "SmartClip Core",
    id: "com.mintlogic.smartclip.core",
    exe: "SmartClipCore",
    artifact: "SmartClip Core Setup \${version}.\${ext}",
    shortcut: "SmartClip",
    uninstall: "SmartClip"
};

try {
    console.log(`[1/3] Preparing clean source files to Staging Directory...`);
    
    const tempDir = path.join(__dirname, 'dist', `temp_src_${type}`);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const validFilesToMod = [];

    const allFiles = [...filesToMod, ...staticFiles];
    allFiles.forEach(fileName => {
        const filePath = path.join(__dirname, fileName);
        if (fs.existsSync(filePath)) {
            validFilesToMod.push(fileName);
            console.log(`      ✔️ Preparing ${fileName}...`);
            
            if (staticFiles.includes(fileName)) {
                // It's an icon, copy it directly
                fs.copyFileSync(filePath, path.join(tempDir, fileName));
            } else {
                // It's a JS file, inject the Pro/Core status
                let content = fs.readFileSync(filePath, 'utf8');
                if (fileName === 'main.js') {
                    content = content.replace(targetLineRegex, newLine);
                }
                fs.writeFileSync(path.join(tempDir, fileName), content);
            }
        }
    });

    const distPath = path.join(__dirname, 'dist', type);
    if (fs.existsSync(distPath)) {
        console.log(`[2/3] Cleaning output directory...`);
        fs.rmSync(distPath, { recursive: true, force: true });
    }

    console.log(`[3/3] Building binary as "${config.name}"...`);

    let userFiles = pkg.build && pkg.build.files ? [...pkg.build.files] : ["**/*"];
    validFilesToMod.forEach(f => userFiles.push(`!${f}`)); 
    
    userFiles.push({
        from: `dist/temp_src_${type}`,
        to: ".",
        filter: validFilesToMod
    });

    const builderConfig = JSON.parse(JSON.stringify(pkg.build || {}));
    builderConfig.files = userFiles;
    builderConfig.nsis = builderConfig.nsis || {};
    builderConfig.nsis.oneClick = false;
    builderConfig.nsis.perMachine = true;
    
    const configPath = path.join(__dirname, 'dist', `temp_builder_config_${type}.json`);
    fs.writeFileSync(configPath, JSON.stringify(builderConfig, null, 2));

    const cmd = [
        `npx electron-builder`,
        `--config "${configPath}"`,
        `--config.productName="${config.name}"`,
        `--config.appId="${config.id}"`,
        `--config.win.executableName="${config.exe}"`,
        `--config.nsis.artifactName="${config.artifact}"`,
        `--config.nsis.shortcutName="${config.shortcut}"`,
        `--config.nsis.uninstallDisplayName="${config.uninstall}"`,
        `--config.directories.output="dist/${type}"`,
        `--config.nsis.runAfterFinish=true`,
        `-c.buildDependenciesFromSource=true`
    ].join(" ");

    execSync(cmd, { stdio: 'inherit' });
    console.log(`\n✅ BUILD COMPLETE! Output in dist/${type}/`);

} catch (error) {
    console.error(`\n❌ BUILD FAILED:`, error.message);
    process.exit(1);
}