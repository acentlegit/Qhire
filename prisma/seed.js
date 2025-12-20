const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')
  
  const user = await prisma.user.upsert({
    where: { email: 'admin@qhire.local' },
    update: {},
    create: {
      email: 'admin@qhire.local',
      name: 'Admin User',
      role: 'ADMIN'
    }
  })

  console.log('Created user:', user)
  console.log('User ID:', user.id)
  console.log('\n✅ Seed completed!')
  console.log('Use this user ID in your job creation form: ' + user.id)
}

main()
  .catch((e) => {
    console.error('Error seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

