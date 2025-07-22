// Debug module to check for account ID collisions

import { getCashAccounts, getDebtAccounts, getTransactions } from './database.js'

export async function checkAccountIdCollisions() {
  try {
    console.log('=== Checking for Account ID Collisions ===')
    
    // Get all accounts
    const cashAccounts = await getCashAccounts()
    const debtAccounts = await getDebtAccounts()
    
    console.log('\nCash Accounts:')
    cashAccounts.forEach(acc => {
      console.log(`  ID: ${acc.id}, Name: ${acc.name}, Balance: ${acc.balance}`)
    })
    
    console.log('\nDebt Accounts:')
    debtAccounts.forEach(acc => {
      console.log(`  ID: ${acc.id}, Name: ${acc.name}, Balance: ${acc.balance}`)
    })
    
    // Check for ID collisions
    const cashIds = new Set(cashAccounts.map(acc => acc.id))
    const debtIds = new Set(debtAccounts.map(acc => acc.id))
    
    const collisions = []
    cashIds.forEach(id => {
      if (debtIds.has(id)) {
        collisions.push(id)
      }
    })
    
    if (collisions.length > 0) {
      console.log('\n⚠️  WARNING: Found ID collisions between cash and debt accounts!')
      console.log('Colliding IDs:', collisions)
      
      // Show which accounts are affected
      collisions.forEach(id => {
        const cashAcc = cashAccounts.find(acc => acc.id === id)
        const debtAcc = debtAccounts.find(acc => acc.id === id)
        console.log(`\nID ${id} collision:`)
        console.log(`  Cash Account: ${cashAcc?.name} (Balance: ${cashAcc?.balance})`)
        console.log(`  Debt Account: ${debtAcc?.name} (Balance: ${debtAcc?.balance})`)
      })
    } else {
      console.log('\n✅ No ID collisions found between cash and debt accounts')
    }
    
    // Check transaction counts
    const transactions = await getTransactions()
    console.log(`\nTotal transactions: ${transactions.length}`)
    
    // Count transactions per account
    const transactionCounts = {}
    transactions.forEach(t => {
      if (t.account_id) {
        transactionCounts[t.account_id] = (transactionCounts[t.account_id] || 0) + 1
      }
    })
    
    console.log('\nTransactions per account ID:')
    Object.entries(transactionCounts).forEach(([id, count]) => {
      const cashAcc = cashAccounts.find(acc => acc.id == id)
      const debtAcc = debtAccounts.find(acc => acc.id == id)
      
      if (cashAcc && debtAcc) {
        console.log(`  ID ${id}: ${count} transactions (COLLISION - both ${cashAcc.name} and ${debtAcc.name})`)
      } else if (cashAcc) {
        console.log(`  ID ${id}: ${count} transactions (Cash: ${cashAcc.name})`)
      } else if (debtAcc) {
        console.log(`  ID ${id}: ${count} transactions (Debt: ${debtAcc.name})`)
      } else {
        console.log(`  ID ${id}: ${count} transactions (Unknown account)`)
      }
    })
    
    return { cashAccounts, debtAccounts, collisions }
  } catch (error) {
    console.error('Error checking account collisions:', error)
    throw error
  }
}

// Add this function to window for easy console access
if (typeof window !== 'undefined') {
  window.checkAccountIdCollisions = checkAccountIdCollisions
}