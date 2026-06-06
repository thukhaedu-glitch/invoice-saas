import{useState,useEffect,useMemo}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,doc,addDoc,deleteDoc,serverTimestamp}from'firebase/firestore'
import Layout from'../components/Layout'
import*as XLSX from'xlsx'
import{Plus,X,Download,Save,Trash2,FileText,Filter,Columns,RefreshCcw,ChevronDown,ChevronUp}from'lucide-react'

const DATA_SOURCES={
invoices:{
label:'Invoices',
columns:[
{key:'invoiceNumber',label:'Invoice #'},
{key:'clientName',label:'Client'},
{key:'date',label:'Date'},
{key:'dueDate',label:'Due Date'},
{key:'totalAmount',label:'Total Amount'},
{key:'paidAmount',label:'Paid Amount'},
{key:'remainingAmount',label:'Remaining'},
{key:'status',label:'Status'},
{key:'taxRate',label:'Tax Rate'},
{key:'discount',label:'Discount'},
{key:'projectId',label:'Project ID'},
],
pivotOptions:[
{value:'clientName',label:'By Client'},
{value:'month',label:'By Month'},
{value:'status',label:'By Status'},
],
valueField:'totalAmount',
},
expenses:{
label:'Expenses',
columns:[
{key:'title',label:'Title'},
{key:'category',label:'Category'},
{key:'date',label:'Date'},
{key:'amount',label:'Amount'},
{key:'vendor',label:'Vendor'},
{key:'description',label:'Description'},
{key:'fromAccount',label:'From Account'},
],
pivotOptions:[
{value:'category',label:'By Category'},
{value:'month',label:'By Month'},
{value:'vendor',label:'By Vendor'},
],
valueField:'amount',
},
bills:{
label:'Bills & Payable',
columns:[
{key:'billNumber',label:'Bill #'},
{key:'title',label:'Title'},
{key:'vendor',label:'Vendor'},
{key:'category',label:'Category'},
{key:'billDate',label:'Bill Date'},
{key:'dueDate',label:'Due Date'},
{key:'amount',label:'Amount'},
{key:'paidAmount',label:'Paid'},
{key:'remainingAmount',label:'Remaining'},
{key:'status',label:'Status'},
],
pivotOptions:[
{value:'vendor',label:'By Vendor'},
{value:'category',label:'By Category'},
{value:'month',label:'By Month'},
],
valueField:'amount',
},
customers:{
label:'Customers',
columns:[
{key:'name',label:'Name'},
{key:'email',label:'Email'},
{key:'phone',label:'Phone'},
{key:'address',label:'Address'},
{key:'customerId',label:'Customer ID'},
{key:'createdAt',label:'Created At'},
],
pivotOptions:[],
valueField:'',
},
}

const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ReportBuilder(){
const[companyId,setCompanyId]=useState(null)
const[rawData,setRawData]=useState({invoices:[],expenses:[],bills:[],customers:[]})
const[loading,setLoading]=useState(true)
const[activeSource,setActiveSource]=useState('invoices')
const[selectedCols,setSelectedCols]=useState([])
const[filters,setFilters]=useState({dateFrom:'',dateTo:'',status:'',year:'',month:'',search:''})
const[reportMode,setReportMode]=useState('raw') // raw | pivot
const[pivotBy,setPivotBy]=useState('clientName')
const[savedReports,setSavedReports]=useState([])
const[reportName,setReportName]=useState('')
const[saving,setSaving]=useState(false)
const[showSaved,setShowSaved]=useState(false)
const[sortCol,setSortCol]=useState(null)
const[sortDir,setSortDir]=useState('asc')

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[invSnap,expSnap,billSnap,custSnap,savedSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'expenses')),
getDocs(collection(db,'companies',cid,'bills')),
getDocs(collection(db,'companies',cid,'customers')),
getDocs(collection(db,'companies',cid,'savedReports')),
])
setRawData({
invoices:invSnap.docs.map(d=>({id:d.id,...d.data()})),
expenses:expSnap.docs.map(d=>({id:d.id,...d.data()})),
bills:billSnap.docs.map(d=>({id:d.id,...d.data()})),
customers:custSnap.docs.map(d=>({id:d.id,...d.data()})),
})
setSavedReports(savedSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

// Set default columns when source changes
useEffect(()=>{
const src=DATA_SOURCES[activeSource]
if(src){
setSelectedCols(src.columns.slice(0,6).map(c=>c.key))
setPivotBy(src.pivotOptions[0]?.value||'')
setFilters({dateFrom:'',dateTo:'',status:'',year:'',month:'',search:''})
setSortCol(null)
}
},[activeSource])

const sourceData=rawData[activeSource]||[]
const srcDef=DATA_SOURCES[activeSource]

// Get date field
const getDate=(row)=>{
if(activeSource==='invoices')return row.date||(row.createdAt?.seconds?new Date(row.createdAt.seconds*1000).toISOString().split('T')[0]:null)
if(activeSource==='expenses')return row.date
if(activeSource==='bills')return row.billDate
if(activeSource==='customers')return row.createdAt?.seconds?new Date(row.createdAt.seconds*1000).toISOString().split('T')[0]:null
return null
}

// Filter data
const filteredData=useMemo(()=>{
let data=[...sourceData]
if(filters.dateFrom)data=data.filter(r=>(getDate(r)||'')>=filters.dateFrom)
if(filters.dateTo)data=data.filter(r=>(getDate(r)||'')<=filters.dateTo)
if(filters.year)data=data.filter(r=>(getDate(r)||'').startsWith(filters.year))
if(filters.month&&filters.year)data=data.filter(r=>(getDate(r)||'').startsWith(`${filters.year}-${filters.month}`))
if(filters.status)data=data.filter(r=>r.status===filters.status)
if(filters.search){
const q=filters.search.toLowerCase()
data=data.filter(r=>
Object.values(r).some(v=>String(v||'').toLowerCase().includes(q))
)
}
// Sort
if(sortCol){
data=[...data].sort((a,b)=>{
const av=a[sortCol]||''
const bv=b[sortCol]||''
const cmp=String(av).localeCompare(String(bv),undefined,{numeric:true})
return sortDir==='asc'?cmp:-cmp
})
}
return data
},[sourceData,filters,sortCol,sortDir])

// Pivot data
const pivotData=useMemo(()=>{
if(reportMode!=='pivot'||!pivotBy)return[]
const valueField=srcDef.valueField

// Get pivot row key
const getKey=(row)=>{
if(pivotBy==='month'){
const d=getDate(row)
return d?d.slice(0,7):'-'
}
return String(row[pivotBy]||'-')
}

// Get all unique column keys
const colKeys=[...new Set(filteredData.map(getKey))].sort()

// Group
const groups={}
filteredData.forEach(row=>{
const rowKey=pivotBy==='month'?'Revenue/Amount':row[Object.keys(row).find(k=>k!==pivotBy&&k!==valueField&&k!=='id')||'id']||'-'
const colKey=getKey(row)
if(!groups[rowKey])groups[rowKey]={_key:rowKey}
groups[rowKey][colKey]=(groups[rowKey][colKey]||0)+Number(row[valueField]||0)
})

// Add totals
return Object.values(groups).map(row=>{
const total=colKeys.reduce((s,k)=>s+(row[k]||0),0)
return{...row,_total:total}
})
},[filteredData,reportMode,pivotBy])

const pivotCols=useMemo(()=>{
if(reportMode!=='pivot')return[]
const getKey=(row)=>{
if(pivotBy==='month'){
const d=getDate(row)
return d?d.slice(0,7):'-'
}
return String(row[pivotBy]||'-')
}
return[...new Set(filteredData.map(getKey))].sort()
},[filteredData,reportMode,pivotBy])

// Selected column defs
const selectedColDefs=selectedCols.map(k=>srcDef.columns.find(c=>c.key===k)).filter(Boolean)

// Export Raw XLSX
const exportRawXLSX=()=>{
const rows=filteredData.map(row=>{
const obj={}
selectedColDefs.forEach(col=>{
let v=row[col.key]
if(col.key==='date'||col.key==='billDate')v=getDate(row)||v
if(typeof v==='number')v=v
else v=String(v||'-')
obj[col.label]=v
})
return obj
})
const ws=XLSX.utils.json_to_sheet(rows)
const wb=XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb,ws,'Report')
// Auto column width
const cols=selectedColDefs.map(c=>({wch:Math.max(c.label.length,12)}))
ws['!cols']=cols
XLSX.writeFile(wb,`Report_${activeSource}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// Export Pivot XLSX
const exportPivotXLSX=()=>{
if(!pivotData.length)return
const headers=['Group',...pivotCols,'Total']
const rows=pivotData.map(row=>[
row._key,
...pivotCols.map(c=>row[c]||0),
row._total||0,
])
const ws=XLSX.utils.aoa_to_sheet([headers,...rows])
// Style header
ws['!cols']=[{wch:20},...pivotCols.map(()=>({wch:14})),{wch:14}]
const wb=XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb,ws,'Pivot')
XLSX.writeFile(wb,`Pivot_${activeSource}_${pivotBy}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// Export CSV
const exportCSV=()=>{
const headers=selectedColDefs.map(c=>c.label).join(',')
const rows=filteredData.map(row=>selectedColDefs.map(col=>`"${row[col.key]||'-'}"`).join(','))
const blob=new Blob([headers+'\n'+rows.join('\n')],{type:'text/csv'})
const url=URL.createObjectURL(blob)
const a=document.createElement('a')
a.href=url;a.download=`Report_${activeSource}_${new Date().toISOString().split('T')[0]}.csv`;a.click()
URL.revokeObjectURL(url)
}

// Save Report
const handleSave=async()=>{
if(!reportName.trim()){alert('Report name required');return}
setSaving(true)
try{
const ref=await addDoc(collection(db,'companies',companyId,'savedReports'),{
name:reportName,
source:activeSource,
columns:selectedCols,
filters,
reportMode,
pivotBy,
createdAt:serverTimestamp(),
})
setSavedReports(prev=>[{id:ref.id,name:reportName,source:activeSource,columns:selectedCols,filters,reportMode,pivotBy},...prev])
setReportName('')
alert('Report saved ✓')
}catch(e){alert(e.message)}
setSaving(false)
}

// Load Report
const loadReport=(r)=>{
setActiveSource(r.source)
setSelectedCols(r.columns)
setFilters(r.filters||{dateFrom:'',dateTo:'',status:'',year:'',month:'',search:''})
setReportMode(r.reportMode||'raw')
setPivotBy(r.pivotBy||'')
setShowSaved(false)
}

// Delete saved report
const deleteSaved=async(id)=>{
if(!confirm('Delete this saved report?'))return
await deleteDoc(doc(db,'companies',companyId,'savedReports',id))
setSavedReports(prev=>prev.filter(r=>r.id!==id))
}

const toggleCol=(key)=>{
setSelectedCols(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key])
}

const handleSort=(key)=>{
if(sortCol===key)setSortDir(d=>d==='asc'?'desc':'asc')
else{setSortCol(key);setSortDir('asc')}
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

const th={padding:'9px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'0.5px solid var(--border)',background:'#fafbff',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none'}
const td={padding:'9px 12px',fontSize:12,borderBottom:'0.5px solid #f1f5f9',color:'var(--text-1)'}

return(
<Layout title="Report Builder">

{/* Toolbar */}
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
<div style={{display:'flex',alignItems:'center',gap:8}}>
<h2 style={{fontSize:16,fontWeight:700}}>Report Builder</h2>
<span style={{fontSize:11,background:'#f1f5f9',color:'var(--text-3)',padding:'2px 8px',borderRadius:20}}>{filteredData.length} rows</span>
</div>
<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
<button type="button" onClick={()=>setShowSaved(v=>!v)} className="btn btn-ghost" style={{fontSize:12}}>
<FileText size={13}/>Saved ({savedReports.length})
</button>
<button type="button" onClick={exportCSV} className="btn btn-ghost" style={{fontSize:12}}>
<Download size={13}/>CSV
</button>
<button type="button" onClick={reportMode==='pivot'?exportPivotXLSX:exportRawXLSX} className="btn btn-ghost" style={{fontSize:12}}>
<Download size={13}/>XLSX {reportMode==='pivot'?'(Pivot)':'(Raw)'}
</button>
</div>
</div>

{/* Saved Reports Panel */}
{showSaved&&(
<div className="card" style={{padding:16,marginBottom:16}}>
<div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Saved Reports</div>
{savedReports.length===0?(
<div style={{color:'var(--text-3)',fontSize:12,textAlign:'center',padding:16}}>No saved reports</div>
):(
<div style={{display:'grid',gap:8}}>
{savedReports.map(r=>(
<div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'#f8fafc',borderRadius:8,border:'0.5px solid var(--border)'}}>
<div>
<div style={{fontSize:13,fontWeight:500}}>{r.name}</div>
<div style={{fontSize:11,color:'var(--text-3)'}}>{DATA_SOURCES[r.source]?.label} • {r.reportMode} • {r.columns?.length} cols</div>
</div>
<div style={{display:'flex',gap:6}}>
<button type="button" onClick={()=>loadReport(r)} className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}}>Load</button>
<button type="button" onClick={()=>deleteSaved(r.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',padding:4}}><Trash2 size={13}/></button>
</div>
</div>
))}
</div>
)}
</div>
)}

<div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:16,alignItems:'start'}}>

{/* Left Panel */}
<div style={{display:'flex',flexDirection:'column',gap:12}}>

{/* Data Source */}
<div className="card" style={{padding:16}}>
<div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',marginBottom:10}}>Data Source</div>
{Object.entries(DATA_SOURCES).map(([key,src])=>(
<button key={key} type="button" onClick={()=>setActiveSource(key)} style={{
width:'100%',textAlign:'left',padding:'8px 10px',borderRadius:8,marginBottom:4,
border:`1.5px solid ${activeSource===key?'var(--primary)':'transparent'}`,
background:activeSource===key?'rgba(79,110,247,0.06)':'#f8fafc',
cursor:'pointer',fontSize:12,fontWeight:500,
color:activeSource===key?'var(--primary)':'var(--text-2)',
}}>
{src.label}
</button>
))}
</div>

{/* Columns */}
<div className="card" style={{padding:16}}>
<div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<span>Columns</span>
<button type="button" onClick={()=>setSelectedCols(srcDef.columns.map(c=>c.key))} style={{fontSize:10,background:'none',border:'none',cursor:'pointer',color:'var(--primary)'}}>All</button>
</div>
{srcDef.columns.map(col=>(
<label key={col.key} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',cursor:'pointer'}}>
<input type="checkbox" checked={selectedCols.includes(col.key)} onChange={()=>toggleCol(col.key)}/>
<span style={{fontSize:12,color:'var(--text-1)'}}>{col.label}</span>
</label>
))}
</div>

{/* Report Mode */}
<div className="card" style={{padding:16}}>
<div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',marginBottom:10}}>Report Mode</div>
<div style={{display:'flex',gap:6,marginBottom:10}}>
{['raw','pivot'].map(m=>(
<button key={m} type="button" onClick={()=>setReportMode(m)} style={{
flex:1,padding:'6px 0',borderRadius:8,
border:`1.5px solid ${reportMode===m?'var(--primary)':'#e2e8f0'}`,
background:reportMode===m?'var(--primary)':'white',
color:reportMode===m?'white':'var(--text-2)',
cursor:'pointer',fontSize:12,fontWeight:500,textTransform:'capitalize',
}}>
{m}
</button>
))}
</div>
{reportMode==='pivot'&&srcDef.pivotOptions.length>0&&(
<div>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Pivot By</div>
{srcDef.pivotOptions.map(o=>(
<label key={o.value} style={{display:'flex',alignItems:'center',gap:8,padding:'3px 0',cursor:'pointer'}}>
<input type="radio" name="pivotBy" checked={pivotBy===o.value} onChange={()=>setPivotBy(o.value)}/>
<span style={{fontSize:12}}>{o.label}</span>
</label>
))}
</div>
)}
</div>

{/* Filters */}
<div className="card" style={{padding:16}}>
<div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<span>Filters</span>
<button type="button" onClick={()=>setFilters({dateFrom:'',dateTo:'',status:'',year:'',month:'',search:''})} style={{fontSize:10,background:'none',border:'none',cursor:'pointer',color:'#dc2626'}}>Clear</button>
</div>
<div style={{display:'grid',gap:8}}>
<div>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>Search</div>
<input className="form-input" value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))} placeholder="Search..." style={{fontSize:12}}/>
</div>
<div>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>Year</div>
<input className="form-input" value={filters.year} onChange={e=>setFilters(f=>({...f,year:e.target.value}))} placeholder="2026" style={{fontSize:12}}/>
</div>
<div>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>Month</div>
<select className="form-input" value={filters.month} onChange={e=>setFilters(f=>({...f,month:e.target.value}))} style={{fontSize:12}}>
<option value="">All</option>
{['01','02','03','04','05','06','07','08','09','10','11','12'].map((m,i)=>(
<option key={m} value={m}>{monthNames[i]}</option>
))}
</select>
</div>
<div>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>Date From</div>
<input className="form-input" type="date" value={filters.dateFrom} onChange={e=>setFilters(f=>({...f,dateFrom:e.target.value}))} style={{fontSize:12}}/>
</div>
<div>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>Date To</div>
<input className="form-input" type="date" value={filters.dateTo} onChange={e=>setFilters(f=>({...f,dateTo:e.target.value}))} style={{fontSize:12}}/>
</div>
{activeSource!=='customers'&&(
<div>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>Status</div>
<select className="form-input" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))} style={{fontSize:12}}>
<option value="">All</option>
{activeSource==='invoices'&&['paid','pending','partial','overdue','refunded'].map(s=><option key={s} value={s}>{s}</option>)}
{(activeSource==='bills')&&['unpaid','partial','paid','cancelled'].map(s=><option key={s} value={s}>{s}</option>)}
</select>
</div>
)}
</div>
</div>

{/* Save Report */}
<div className="card" style={{padding:16}}>
<div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',marginBottom:10}}>Save Report</div>
<input className="form-input" value={reportName} onChange={e=>setReportName(e.target.value)} placeholder="Report name..." style={{fontSize:12,marginBottom:8}}/>
<button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary" style={{width:'100%',fontSize:12}}>
<Save size={13}/>{saving?'Saving...':'Save Report'}
</button>
</div>

</div>

{/* Right Panel — Table */}
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'12px 16px',borderBottom:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fafbff'}}>
<div style={{fontSize:13,fontWeight:600}}>{DATA_SOURCES[activeSource]?.label} — {reportMode==='pivot'?'Pivot View':'Raw Data'}</div>
<div style={{fontSize:11,color:'var(--text-3)'}}>{filteredData.length} records</div>
</div>
<div style={{overflowX:'auto',maxHeight:'70vh',overflowY:'auto'}}>
{reportMode==='raw'?(
<table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
<thead style={{position:'sticky',top:0,zIndex:1}}>
<tr>
{selectedColDefs.map(col=>(
<th key={col.key} style={th} onClick={()=>handleSort(col.key)}>
<span style={{display:'flex',alignItems:'center',gap:4}}>
{col.label}
{sortCol===col.key?(sortDir==='asc'?<ChevronUp size={10}/>:<ChevronDown size={10}/>):null}
</span>
</th>
))}
</tr>
</thead>
<tbody>
{filteredData.length===0?(
<tr><td colSpan={selectedColDefs.length} style={{...td,textAlign:'center',color:'var(--text-3)',padding:40}}>No data</td></tr>
):filteredData.map((row,i)=>(
<tr key={row.id||i} style={{background:i%2===0?'white':'#fafbff'}}>
{selectedColDefs.map(col=>{
let v=row[col.key]
if(col.key==='date'||col.key==='billDate')v=row.date||row.billDate||'-'
if(typeof v==='number')v=v.toLocaleString()
const isAmount=col.label.toLowerCase().includes('amount')||col.label.toLowerCase().includes('paid')||col.label.toLowerCase().includes('remaining')
const isStatus=col.key==='status'
const statusColors={paid:'#16a34a',pending:'#d97706',overdue:'#dc2626',partial:'#4F6EF7',unpaid:'#dc2626',cancelled:'#64748b'}
return(
<td key={col.key} style={{...td,color:isAmount?'var(--primary)':isStatus?statusColors[v]||'var(--text-1)':'var(--text-1)',fontWeight:isAmount?600:400}}>
{isStatus?(
<span style={{background:statusColors[v]?statusColors[v]+'15':'#f1f5f9',color:statusColors[v]||'#64748b',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,textTransform:'capitalize'}}>{String(v||'-')}</span>
):String(v||'-')}
</td>
)
})}
</tr>
))}
</tbody>
{filteredData.length>0&&selectedColDefs.some(c=>['totalAmount','paidAmount','remainingAmount','amount'].includes(c.key))&&(
<tfoot>
<tr style={{background:'#f1f5f9',borderTop:'1.5px solid #e2e8f0'}}>
{selectedColDefs.map(col=>{
const isNum=['totalAmount','paidAmount','remainingAmount','amount'].includes(col.key)
const total=isNum?filteredData.reduce((s,r)=>s+Number(r[col.key]||0),0):null
return(
<td key={col.key} style={{...td,fontWeight:700,color:'var(--primary)'}}>
{total!==null?total.toLocaleString()+' Ks':col.key===selectedColDefs[0].key?'Total':''}
</td>
)
})}
</tr>
</tfoot>
)}
</table>
):(
// Pivot Table
<table style={{width:'100%',borderCollapse:'collapse',minWidth:400}}>
<thead style={{position:'sticky',top:0,zIndex:1}}>
<tr>
<th style={{...th,background:'#1a1d2e',color:'white'}}>
{srcDef.pivotOptions.find(o=>o.value===pivotBy)?.label||'Group'}
</th>
{pivotCols.map(c=>(
<th key={c} style={{...th,textAlign:'right',background:'#1a1d2e',color:'white'}}>{c}</th>
))}
<th style={{...th,textAlign:'right',background:'#2d3260',color:'white'}}>Total</th>
</tr>
</thead>
<tbody>
{pivotData.length===0?(
<tr><td colSpan={pivotCols.length+2} style={{...td,textAlign:'center',color:'var(--text-3)',padding:40}}>No data</td></tr>
):pivotData.map((row,i)=>(
<tr key={i} style={{background:i%2===0?'white':'#fafbff'}}>
<td style={{...td,fontWeight:500}}>{String(row._key||'-')}</td>
{pivotCols.map(c=>(
<td key={c} style={{...td,textAlign:'right',color:row[c]?'var(--primary)':'var(--text-3)',fontWeight:row[c]?600:400}}>
{row[c]?Number(row[c]).toLocaleString():'-'}
</td>
))}
<td style={{...td,textAlign:'right',fontWeight:700,color:'#16a34a'}}>
{Number(row._total||0).toLocaleString()}
</td>
</tr>
))}
</tbody>
{pivotData.length>0&&(
<tfoot>
<tr style={{background:'#f1f5f9',borderTop:'1.5px solid #e2e8f0'}}>
<td style={{...td,fontWeight:700}}>Grand Total</td>
{pivotCols.map(c=>(
<td key={c} style={{...td,textAlign:'right',fontWeight:700,color:'var(--primary)'}}>
{pivotData.reduce((s,r)=>s+(r[c]||0),0).toLocaleString()}
</td>
))}
<td style={{...td,textAlign:'right',fontWeight:700,color:'#16a34a'}}>
{pivotData.reduce((s,r)=>s+(r._total||0),0).toLocaleString()}
</td>
</tr>
</tfoot>
)}
</table>
)}
</div>
</div>

</div>

</Layout>
)
}
