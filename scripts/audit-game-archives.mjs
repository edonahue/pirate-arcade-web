#!/usr/bin/env node
import { stat } from 'fs/promises';

async function auditArchive(filePath) {
  console.log(`🔍 Auditing ${filePath}...`);
  
  // Get file size
  const stats = await stat(filePath);
  const compressedSize = stats.size;
  
  console.log(`  📦 Compressed size: ${(compressedSize / 1024).toFixed(1)} KB`);
  
  // Basic validation - file exists and is not empty
  if (compressedSize === 0) {
    console.log(`  ❌ Archive is empty`);
    return false;
  }
  
  if (compressedSize < 1024) { // Less than 1KB
    console.log(`  ⚠️  Archive is suspiciously small`);
  }
  
  // Check file extension
  if (!filePath.endsWith('.tar.gz')) {
    console.log(`  ⚠️  File does not have .tar.gz extension`);
  }
  
  console.log(`  ✅ Basic archive validation passed`);
  return true;
}

async function main() {
  const archives = [
    'public/play/cannonball-clash/cannonball-clash.tar.gz',
    'public/play/treasure-cove/treasure-cove.tar.gz',
    'public/play/krakens-wake/krakens-wake.tar.gz'
  ];
  
  let allPassed = true;
  
  for (const archive of archives) {
    const passed = await auditArchive(archive);
    allPassed = allPassed && passed;
    console.log('');
  }
  
  if (allPassed) {
    console.log('🎉 All archives passed basic audit!');
    process.exit(0);
  } else {
    console.log('💥 Some archives failed audit!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Audit script failed:', err);
  process.exit(1);
});