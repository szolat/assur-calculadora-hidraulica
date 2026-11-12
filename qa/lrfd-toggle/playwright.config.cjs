const {defineConfig}=require('@playwright/test');

module.exports=defineConfig({
  testDir:__dirname,
  testMatch:'*.spec.cjs',
  fullyParallel:false,
  workers:1,
  retries:0,
  forbidOnly:true,
  reporter:'list',
  outputDir:'test-results',
  timeout:20000,
  use:{
    browserName:'chromium',
    channel:'chromium',
    headless:true,
    viewport:{width:1440,height:1000},
    actionTimeout:5000,
    trace:'retain-on-failure',
    screenshot:'only-on-failure'
  }
});
