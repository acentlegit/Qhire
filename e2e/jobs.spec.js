import { test, expect } from '@playwright/test'

test.describe('Jobs Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to sign in page
    await page.goto('/auth/signin')
    
    // Sign in (adjust credentials as needed)
    await page.fill('input[name="email"]', 'admin@qhire.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    await page.waitForURL('/dashboard')
  })

  test('should create a new job', async ({ page }) => {
    await page.goto('/job/create')
    
    // Fill job form
    await page.fill('input[name="title"]', 'Senior Software Engineer')
    await page.fill('textarea[name="description"]', 'We are looking for a senior software engineer...')
    await page.selectOption('select[name="status"]', 'OPEN')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Verify success
    await expect(page.locator('text=Job created successfully')).toBeVisible()
  })

  test('should list jobs', async ({ page }) => {
    await page.goto('/jobs')
    
    // Check if jobs list is visible
    await expect(page.locator('h1')).toContainText('Jobs')
  })
})

