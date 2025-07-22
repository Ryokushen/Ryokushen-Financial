// Debug script to check account IDs
import { getCashAccounts, getDebtAccounts, getTransactions } from './database.js'

export async function debugAccountIDs() {
  try {
    console.log('=== DEBUGGING ACCOUNT IDS ===')
    
    // Get all accounts
    const [cashAccounts, debtAccounts] = await Promise.all([
      getCashAccounts(),
      getDebtAccounts()
    ])
    
    console.log('\nCash Accounts:')
    cashAccounts.forEach(acc => {
      console.log(`  ID: ${acc.id}, Name: ${acc.name}, Type: ${acc.type}`)
    })
    
    console.log('\nDebt Accounts:')
    debtAccounts.forEach(acc => {
      console.log(`  ID: ${acc.id}, Name: ${acc.name}, Type: ${acc.type}`)
    })
    
    // Check for ID collisions
    const cashIds = new Set(cashAccounts.map(acc => acc.id))
    const debtIds = new Set(debtAccounts.map(acc => acc.id))
    const collisions = []
    
    debtIds.forEach(id => {
      if (cashIds.has(id)) {
        collisions.push(id)
      }
    })
    
    if (collisions.length > 0) {
      console.log('\n⚠️  ID COLLISIONS DETECTED:', collisions)
      collisions.forEach(id => {
        const cashAcc = cashAccounts.find(acc => acc.id === id)
        const debtAcc = debtAccounts.find(acc => acc.id === id)
        console.log(`  ID ${id}: Cash="${cashAcc?.name}" vs Debt="${debtAcc?.name}"`)
      })
    } else {
      console.log('\n✅ No ID collisions found')
    }
    
    // Check specific accounts mentioned by user
    console.log('\n=== SPECIFIC ACCOUNTS ===')
    const debitChecking = cashAccounts.find(acc => acc.name.includes('Debit Checking'))
    const visaSignature = debtAccounts.find(acc => acc.name.includes('Visa Signature'))
    
    console.log(`Debit Checking: ID=${debitChecking?.id}, Name="${debitChecking?.name}"`)
    console.log(`Visa Signature: ID=${visaSignature?.id}, Name="${visaSignature?.name}"`)
    
    if (debitChecking && visaSignature && debitChecking.id === visaSignature.id) {
      console.log('⚠️  These accounts have the SAME ID!')
    }
    
    // Get some transactions for these accounts
    if (debitChecking || visaSignature) {
      const transactions = await getTransactions()
      
      if (debitChecking) {
        const debitTxns = transactions.filter(t => t.account_id === debitChecking.id)
        console.log(`\nDebit Checking transactions: ${debitTxns.length}`)
        if (debitTxns.length > 0) {
          console.log('  Recent:', debitTxns.slice(0, 3).map(t => 
            `${t.date} ${t.description} ${t.amount}`
          ))
        }
      }
      
      if (visaSignature) {
        const visaTxns = transactions.filter(t => t.account_id === visaSignature.id)
        console.log(`\nVisa Signature transactions: ${visaTxns.length}`)
        if (visaTxns.length > 0) {
          console.log('  Recent:', visaTxns.slice(0, 3).map(t => 
            `${t.date} ${t.description} ${t.amount}`
          ))
        }
      }
    }
    
  } catch (error) {
    console.error('Debug error:', error)
  }
}