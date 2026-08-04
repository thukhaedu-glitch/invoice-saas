import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

export function resolveCurrency(settings = {}) {
  const code = settings.baseCurrency || 'MMK'
  const selected = (settings.currencies || []).find(currency => currency.code === code)
  return {
    code,
    symbol: selected?.symbol || (code === 'MMK' ? 'Ks' : code),
  }
}

export function useCurrency(companyId) {
  const [currency, setCurrency] = useState({ code: 'MMK', symbol: 'Ks' })

  useEffect(() => {
    if (!companyId) return
    getDoc(doc(db, 'companies', companyId, '_config', 'invoiceSettings'))
      .then(snapshot => {
        if (snapshot.exists()) setCurrency(resolveCurrency(snapshot.data()))
      })
      .catch(() => {})
  }, [companyId])

  return currency
}
