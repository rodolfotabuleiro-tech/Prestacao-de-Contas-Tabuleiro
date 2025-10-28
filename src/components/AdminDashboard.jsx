import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function AdminDashboard(){
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [filter, setFilter] = useState({ store:'', responsible:'', status:'', from:'', to:'' })
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    supabase.auth.getSession().then(r=> setUser(r.data?.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setUser(sess?.user ?? null))
    return () => listener.unsubscribe()
  },[])

  useEffect(()=>{ if(!user) return; supabase.from('user_profiles').select('role').eq('id', user.id).single().then(({ data })=> setIsAdmin(data?.role === 'admin')) }, [user])

  async function fetchAll(){
    if(!user || !isAdmin) return
    setLoading(true)
    try{
      let query = supabase.from('prestacoes').select('*, despesas(*)').order('created_at', { ascending:false })
      if(filter.store) query = query.eq('store', filter.store)
      if(filter.status) query = query.eq('status', filter.status)
      if(filter.responsible) query = query.ilike('responsible', `%${filter.responsible}%`)
      if(filter.from) query = query.gte('date', filter.from)
      if(filter.to) query = query.lte('date', filter.to)
      const { data: rows, error } = await query
      if(error) throw error
      setData(rows || [])
    }catch(err){ console.error(err); alert('Erro: '+err.message) }finally{ setLoading(false) }
  }

  useEffect(()=>{ if(isAdmin) fetchAll() }, [isAdmin])

  async function setStatus(prestacaoId, newStatus){
    if(!isAdmin) return alert('Apenas admins podem aprovar/reprovar.')
    const { error } = await supabase.from('prestacoes').update({ status: newStatus, approver_id: user.id, approved_at: new Date().toISOString() }).eq('id', prestacaoId)
    if(error) return alert('Erro: '+ error.message)
    await fetchAll()
  }

  function buildReportRows(){
    const rows = []
    for(const p of data){
      if(!p.despesas || p.despesas.length===0) rows.push({ id:p.id, date:p.date, store:p.store, responsible:p.responsible, status:p.status, declared_total:p.declared_total, computed_total:p.computed_total, expense_date:'', expense_desc:'', expense_value:'' })
      else for(const d of p.despesas) rows.push({ id:p.id, date:p.date, store:p.store, responsible:p.responsible, status:p.status, declared_total:p.declared_total, computed_total:p.computed_total, expense_date:d.date, expense_desc:d.description, expense_value:d.value })
    }
    return rows
  }

  function exportToCSV(rows, filename='report.csv'){
    if(!rows || rows.length===0) return
    const headers = Object.keys(rows[0])
    const csv = [headers.join(',')].concat(rows.map(r=> headers.map(h=> `"${String(r[h] ?? '')}"`).join(',')).join('\n')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-3">Admin Dashboard</h2>
      {!isAdmin && <div>Você não é admin ou perfil ainda não carregado.</div>}
      {isAdmin && (
        <div>
          <div className="flex gap-2 mb-3">
            <input placeholder="Loja" value={filter.store} onChange={e=>setFilter(f=>({...f, store:e.target.value}))} className="border p-2 rounded" />
            <input placeholder="Responsável" value={filter.responsible} onChange={e=>setFilter(f=>({...f, responsible:e.target.value}))} className="border p-2 rounded" />
            <select value={filter.status} onChange={e=>setFilter(f=>({...f, status:e.target.value}))} className="border p-2 rounded">
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovado</option>
              <option value="rejected">Reprovado</option>
            </select>
            <input type="date" value={filter.from} onChange={e=>setFilter(f=>({...f, from:e.target.value}))} className="border p-2 rounded" />
            <input type="date" value={filter.to} onChange={e=>setFilter(f=>({...f, to:e.target.value}))} className="border p-2 rounded" />
            <button onClick={fetchAll} className="px-3 py-1 border rounded">Filtrar</button>
            <button onClick={()=> exportToCSV(buildReportRows(), `report_${new Date().toISOString()}.csv`)} className="px-3 py-1 border rounded">Exportar CSV</button>
          </div>

          <div>
            {loading && <div>Carregando...</div>}
            {data.map(p => (
              <div key={p.id} className="border p-3 mb-3 rounded">
                <div className="flex justify-between">
                  <div>
                    <strong>{p.store}</strong> — {p.date} — {p.responsible}
                    <div>Status: <em>{p.status}</em></div>
                    <div>Declarado: R$ {Number(p.declared_total).toFixed(2)} • Calculado: R$ {Number(p.computed_total).toFixed(2)}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={()=> setStatus(p.id, 'approved')} className="px-2 py-1 border rounded">Aprovar</button>
                    <button onClick={()=> setStatus(p.id, 'rejected')} className="px-2 py-1 border rounded">Reprovar</button>
                    <button onClick={async ()=> {
                      if(!p.despesas) return alert('Sem despesas.')
                      const urls = await Promise.all(p.despesas.map(async d => {
                        if(!d.receipt_path) return null
                        const { data, error } = supabase.storage.from('receipts').getPublicUrl(d.receipt_path)
                        return data?.publicUrl ?? null
                      }))
                      const viewer = window.open(); viewer.document.write('<h3>Comprovantes</h3>'); urls.filter(Boolean).forEach(u=> viewer.document.write(`<div><a href="${u}" target="_blank">${u}</a></div>`))
                    }} className="px-2 py-1 border rounded">Ver comprovantes</button>
                  </div>
                </div>

                <div className="mt-3">
                  <table className="w-full border-collapse">
                    <thead><tr><th className="border px-2 py-1">Data</th><th className="border px-2 py-1">Descrição</th><th className="border px-2 py-1">Valor</th></tr></thead>
                    <tbody>{p.despesas && p.despesas.map(d=> (<tr key={d.id}><td className="border px-2 py-1">{d.date}</td><td className="border px-2 py-1">{d.description}</td><td className="border px-2 py-1">R$ {Number(d.value).toFixed(2)}</td></tr>))}</tbody>
                  </table>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
