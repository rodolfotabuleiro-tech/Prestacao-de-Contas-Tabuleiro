import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function PrestacaoForm() {
  const [user, setUser] = useState(null)
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [store, setStore] = useState('ATMOSFERA')
  const [responsible, setResponsible] = useState('')
  const [declaredTotal, setDeclaredTotal] = useState(0)
  const [expenses, setExpenses] = useState([{ id: Date.now(), date: date, description: '', value: 0, file: null }])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    supabase.auth.getSession().then(r=> setUser(r.data?.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setUser(sess?.user ?? null))
    return () => listener.unsubscribe()
  },[])

  function addExpense(){ setExpenses(prev=>[...prev, { id: Date.now(), date, description:'', value:0, file:null }]) }
  function updateExpense(id, patch){ setExpenses(prev=> prev.map(e => e.id === id ? { ...e, ...patch } : e)) }
  function removeExpense(id){ setExpenses(prev=> prev.filter(e => e.id !== id)) }
  const computedTotal = expenses.reduce((s,e)=> s + Number(e.value || 0), 0)

  async function uploadFile(file, userId){
    if(!file) return null
    const fileName = `${userId}/receipts/${Date.now()}_${file.name}`
    const { data, error } = await supabase.storage.from('receipts').upload(fileName, file)
    if(error){ console.error(error); return null }
    return fileName
  }

  async function savePrestacao(){
    if(!user) return alert('Faça login antes de salvar.')
    setLoading(true)
    try {
      const { data: prestData, error: err1 } = await supabase.from('prestacoes').insert([{
        user_id: user.id,
        date,
        store,
        responsible,
        declared_total: declaredTotal,
        computed_total: computedTotal,
        status: 'pending'
      }]).select().single()
      if(err1) throw err1
      const prestacaoId = prestData.id
      for(const e of expenses){
        let receipt_path = null
        if(e.file) receipt_path = await uploadFile(e.file, user.id)
        const { error: err2 } = await supabase.from('despesas').insert([{
          prestacao_id: prestacaoId,
          date: e.date,
          description: e.description,
          value: e.value,
          receipt_path
        }])
        if(err2) throw err2
      }
      alert('Salvo com sucesso.')
    } catch(err){
      console.error(err); alert('Erro ao salvar: ' + err.message)
    } finally{ setLoading(false) }
  }

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-3">Registrar Prestação</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <label className="flex flex-col">Data<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border p-2 rounded mt-1" /></label>
        <label className="flex flex-col">Loja<input value={store} onChange={e=>setStore(e.target.value)} className="border p-2 rounded mt-1" /></label>
        <label className="flex flex-col">Responsável<input value={responsible} onChange={e=>setResponsible(e.target.value)} className="border p-2 rounded mt-1" /></label>
        <label className="flex flex-col md:col-span-2">Valor declarado<input type="number" value={declaredTotal} onChange={e=>setDeclaredTotal(Number(e.target.value))} className="border p-2 rounded mt-1 w-48" /></label>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2"><strong>Despesas</strong><div><button onClick={addExpense} className="px-3 py-1 border rounded">Adicionar</button></div></div>
        <table className="w-full border-collapse">
          <thead><tr><th className="border px-2 py-1">Data</th><th className="border px-2 py-1">Descrição</th><th className="border px-2 py-1">Valor</th><th className="border px-2 py-1">Comprovante</th><th className="border px-2 py-1">Ações</th></tr></thead>
          <tbody>
            {expenses.map(e=> (
              <tr key={e.id}>
                <td className="border px-2 py-1"><input type="date" value={e.date} onChange={ev=>updateExpense(e.id, { date: ev.target.value })} className="p-1 rounded" /></td>
                <td className="border px-2 py-1"><input value={e.description} onChange={ev=>updateExpense(e.id, { description: ev.target.value })} className="w-full p-1 rounded" /></td>
                <td className="border px-2 py-1 w-32"><input type="number" step="0.01" value={e.value} onChange={ev=>updateExpense(e.id, { value: Number(ev.target.value) })} className="w-full p-1 rounded" /></td>
                <td className="border px-2 py-1 w-40"><input type="file" accept="image/*,.pdf" onChange={ev=>updateExpense(e.id, { file: ev.target.files[0] })} /></td>
                <td className="border px-2 py-1"><button onClick={()=>removeExpense(e.id)} className="px-2 py-1 border rounded">Remover</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <div>Total calculado: <strong>R$ {computedTotal.toFixed(2)}</strong></div>
          <div>Declarado: <strong>R$ {Number(declaredTotal).toFixed(2)}</strong></div>
        </div>
        <div className="flex gap-2">
          <button onClick={savePrestacao} className="px-3 py-1 border rounded" disabled={loading}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
