import{useState,useEffect,useMemo,useCallback}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,doc,setDoc,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{
DndContext,closestCenter,KeyboardSensor,PointerSensor,useSensor,useSensors,DragOverlay
}from'@dnd-kit/core'
import{
SortableContext,sortableKeyboardCoordinates,rectSortingStrategy,useSortable,arrayMove
}from'@dnd-kit/sortable'
import{CSS}from'@dnd-kit/utilities'
import{
LineChart,Line,BarChart,Bar,PieChart,Pie,Cell,
XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer
}from'recharts'
import{
Plus,X,Settings,Save,GripVertical,TrendingUp,TrendingDown,
DollarSign,Users,FileText,BarChart2,PieChart as PieIcon,
Activity,Eye,EyeOff,Palette,Type,RefreshCcw
}from'lucide-react'
import{useNavigate}from'react-router-dom'

const months=['01','02','03','04','05','06','07','08','09','10','11','12']
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const WIDGET_TYPES=[
{type:'revenue_card',label:'Revenue Card',icon:TrendingUp,category:'card'},
{type:'expense_card',label:'Expense Card',icon:TrendingDown,category:'card'},
{type:'profit_card',label:'Net Profit Card',icon:DollarSign,category:'card'},
{type:'receivable_card',label:'Receivable Card',icon:FileText,category:'card'},
{type:'customer_count',label:'Customer Count',icon:Users,category:'card'},
{type:'invoice_count',label:'Invoice Count',icon:FileText,category:'card'},
{type:'line_chart',label:'Line Chart',icon:Activity,category:'chart'},
{type:'bar_chart',label:'Bar Chart',icon:BarChart2,category:'chart'},
{type:'pie_chart',label:'Pie Chart',icon:PieIcon,category:'chart'},
{type:'donut_chart',label:'Donut Chart',icon:PieIcon,category:'chart'},
{type:'top_clients',label:'Top Clients',icon:Users,category:'table'},
{type:'recent_payments',label:'Recent Payments',icon:DollarSign,category:'table'},
]

const DEFAULT_COLORS=['#4F6EF7','#16a34a','#dc2626','#d97706','#8b5cf6','#06b6d4','#f59e0b','#10b981']

const defaultWidget=(type)=>({
id:Date.now().toString(),
type,
title:WIDGET_TYPES.find(w=>w.type===type)?.label||type,
color:'#4F6EF7',
bgColor:'rgba(79,110,247,0.08)',
fontSize:13,
fontWeight:600,
chartColor1:'#4F6EF7',
chartColor2:'#ef4444',
chartColor3:'#16a34a',
chartColor4:'#d97706',
size:'medium', // small/medium/large
year:new Date().getFullYear().toString(),
})

function SortableWidget({widget,onRemove,onEdit,data,isEditing}){
const{attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:widget.id})
const style={
transform:CSS.Transform.toString(transform),
transition,
opacity:isDragging?0.4:1,
}
return(
<div ref={setNodeRef} style={style}>
<WidgetCard widget={widget} onRemove={onRemove} onEdit={onEdit} data={data} dragListeners={listeners} dragAttributes={attributes} isEditing={isEditing}/>
</div>
)
}

function WidgetCard({widget,onRemove,onEdit,data,dragListeners,dragAttributes,isEditing}){
const sizeMap={small:'1',medium:'1',large:'2'}
const fmtK=v=>v>=1000000?`${(v/1000000).toFixed(1)}M`:v>=1000?`${(v/1000).toFixed(0)}K`:Number(v||0).toLocaleString()

const cardStyle={
background:'white',
borderRadius:14,
boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
border:'0.5px solid var(--border)',
overflow:'hidden',
gridColumn:widget.size==='large'?'span 2':'span 1',
}

const headerStyle={
display:'flex',alignItems:'center',justifyContent:'space-between',
padding:'10px 14px',borderBottom:'0.5px solid #f1f5f9',
background:widget.bgColor||'rgba(79,110,247,0.04)',
}

const renderContent=()=>{
const{invoices=[],expenses=[],customers=[],bankAccounts=[]}=data
const year=widget.year||new Date().getFullYear().toString()

const getInvDate=inv=>inv.date||(inv.createdAt?.seconds?new Date(inv.createdAt.seconds*1000).toISOString().split('T')[0]:null)
const yearInv=invoices.filter(i=>getInvDate(i)?.startsWith(year))
const yearExp=expenses.filter(e=>e.date?.startsWith(year))

const revenue=yearInv.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const expense=yearExp.reduce((s,e)=>s+Number(e.amount||0),0)
const profit=revenue-expense
const receivable=invoices.filter(i=>i.status==='pending'||i.status==='partial').reduce((s,i)=>s+Number(i.remainingAmount||i.totalAmount||0),0)

// Card types
if(widget.type==='revenue_card')return(
<div style={{padding:20}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Total Revenue {year}</div>
<div style={{fontSize:widget.fontSize+8||22,fontWeight:widget.fontWeight||700,color:widget.color}}>{fmtK(revenue)} Ks</div>
</div>
)
if(widget.type==='expense_card')return(
<div style={{padding:20}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Total Expenses {year}</div>
<div style={{fontSize:widget.fontSize+8||22,fontWeight:widget.fontWeight||700,color:widget.color}}>{fmtK(expense)} Ks</div>
</div>
)
if(widget.type==='profit_card')return(
<div style={{padding:20}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Net Profit {year}</div>
<div style={{fontSize:widget.fontSize+8||22,fontWeight:widget.fontWeight||700,color:profit>=0?widget.color:'#dc2626'}}>{fmtK(profit)} Ks</div>
</div>
)
if(widget.type==='receivable_card')return(
<div style={{padding:20}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Receivable</div>
<div style={{fontSize:widget.fontSize+8||22,fontWeight:widget.fontWeight||700,color:widget.color}}>{fmtK(receivable)} Ks</div>
</div>
)
if(widget.type==='customer_count')return(
<div style={{padding:20}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Total Customers</div>
<div style={{fontSize:widget.fontSize+8||22,fontWeight:widget.fontWeight||700,color:widget.color}}>{customers.length}</div>
</div>
)
if(widget.type==='invoice_count')return(
<div style={{padding:20}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Total Invoices</div>
<div style={{fontSize:widget.fontSize+8||22,fontWeight:widget.fontWeight||700,color:widget.color}}>{invoices.length}</div>
</div>
)

// Chart types
const chartData=months.map((m,idx)=>{
const mInv=invoices.filter(i=>getInvDate(i)?.startsWith(`${year}-${m}`))
const rev=mInv.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const exp=expenses.filter(e=>e.date?.startsWith(`${year}-${m}`)).reduce((s,e)=>s+Number(e.amount||0),0)
return{month:monthNames[idx],revenue:rev,expense:exp}
}).filter(m=>m.revenue>0||m.expense>0)

if(widget.type==='line_chart')return(
<div style={{padding:'8px 8px 0'}}>
<ResponsiveContainer width="100%" height={160}>
<LineChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
<CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
<XAxis dataKey="month" tick={{fontSize:9,fill:'#9aa0b4'}} axisLine={false} tickLine={false}/>
<YAxis tickFormatter={fmtK} tick={{fontSize:9,fill:'#9aa0b4'}} axisLine={false} tickLine={false} width={35}/>
<Tooltip formatter={(v)=>`${fmtK(v)} Ks`} contentStyle={{fontSize:11,borderRadius:8}}/>
<Legend wrapperStyle={{fontSize:10}}/>
<Line type="monotone" dataKey="revenue" name="Revenue" stroke={widget.chartColor1||'#4F6EF7'} strokeWidth={2} dot={false}/>
<Line type="monotone" dataKey="expense" name="Expense" stroke={widget.chartColor2||'#ef4444'} strokeWidth={2} dot={false}/>
</LineChart>
</ResponsiveContainer>
</div>
)

if(widget.type==='bar_chart')return(
<div style={{padding:'8px 8px 0'}}>
<ResponsiveContainer width="100%" height={160}>
<BarChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
<CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
<XAxis dataKey="month" tick={{fontSize:9,fill:'#9aa0b4'}} axisLine={false} tickLine={false}/>
<YAxis tickFormatter={fmtK} tick={{fontSize:9,fill:'#9aa0b4'}} axisLine={false} tickLine={false} width={35}/>
<Tooltip formatter={(v)=>`${fmtK(v)} Ks`} contentStyle={{fontSize:11,borderRadius:8}}/>
<Legend wrapperStyle={{fontSize:10}}/>
<Bar dataKey="revenue" name="Revenue" fill={widget.chartColor1||'#4F6EF7'} radius={[3,3,0,0]}/>
<Bar dataKey="expense" name="Expense" fill={widget.chartColor2||'#ef4444'} radius={[3,3,0,0]}/>
</BarChart>
</ResponsiveContainer>
</div>
)

const pieData=[
{name:'Revenue',value:revenue},
{name:'Expense',value:expense},
{name:'Receivable',value:receivable},
].filter(d=>d.value>0)
const pieColors=[widget.chartColor1||'#4F6EF7',widget.chartColor2||'#ef4444',widget.chartColor3||'#d97706']

if(widget.type==='pie_chart')return(
<div style={{padding:'8px 0 0'}}>
<ResponsiveContainer width="100%" height={160}>
<PieChart>
<Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
{pieData.map((_,i)=><Cell key={i} fill={pieColors[i%pieColors.length]}/>)}
</Pie>
<Tooltip formatter={(v)=>`${fmtK(v)} Ks`} contentStyle={{fontSize:11,borderRadius:8}}/>
</PieChart>
</ResponsiveContainer>
</div>
)

if(widget.type==='donut_chart')return(
<div style={{padding:'8px 0 0'}}>
<ResponsiveContainer width="100%" height={160}>
<PieChart>
<Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} label={({name,percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
{pieData.map((_,i)=><Cell key={i} fill={pieColors[i%pieColors.length]}/>)}
</Pie>
<Tooltip formatter={(v)=>`${fmtK(v)} Ks`} contentStyle={{fontSize:11,borderRadius:8}}/>
<Legend wrapperStyle={{fontSize:10}}/>
</PieChart>
</ResponsiveContainer>
</div>
)

// Top clients
if(widget.type==='top_clients'){
const map={}
invoices.filter(i=>i.status==='paid'||i.status==='partial').forEach(i=>{
if(!map[i.clientName])map[i.clientName]=0
map[i.clientName]+=Number(i.paidAmount||i.totalAmount||0)
})
const top=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5)
const maxAmt=top[0]?.[1]||1
return(
<div style={{padding:12}}>
{top.length===0?<div style={{textAlign:'center',color:'var(--text-3)',fontSize:12,padding:16}}>No data</div>
:top.map(([name,amt],i)=>(
<div key={name} style={{marginBottom:8}}>
<div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
<span style={{fontWeight:500,color:'var(--text-1)'}}>{i+1}. {name}</span>
<span style={{color:widget.color,fontWeight:600}}>{fmtK(amt)} Ks</span>
</div>
<div style={{height:3,background:'#f1f5f9',borderRadius:2}}>
<div style={{height:3,borderRadius:2,background:widget.color,width:`${Math.round(amt/maxAmt*100)}%`}}/>
</div>
</div>
))}
</div>
)
}

// Recent payments
if(widget.type==='recent_payments'){
const payments=[]
invoices.forEach(inv=>{
(inv.payments||[]).forEach(p=>payments.push({...p,invoiceNumber:inv.invoiceNumber,clientName:inv.clientName}))
})
const recent=payments.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5)
return(
<div style={{padding:12}}>
{recent.length===0?<div style={{textAlign:'center',color:'var(--text-3)',fontSize:12,padding:16}}>No payments</div>
:recent.map((p,i)=>(
<div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'0.5px solid #f8fafc'}}>
<div>
<div style={{fontSize:11,fontWeight:500}}>{p.clientName}</div>
<div style={{fontSize:10,color:'var(--text-3)'}}>{p.date}</div>
</div>
<span style={{fontSize:11,fontWeight:600,color:widget.color}}>{fmtK(p.amount)} Ks</span>
</div>
))}
</div>
)
}

return null
}

return(
<div style={cardStyle}>
<div style={headerStyle}>
<div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
<div {...dragListeners} {...dragAttributes} style={{cursor:'grab',color:'var(--text-3)',flexShrink:0,touchAction:'none'}}>
<GripVertical size={14}/>
</div>
<span style={{fontSize:widget.fontSize||13,fontWeight:widget.fontWeight||600,color:widget.color,truncate:true,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{widget.title}</span>
</div>
{isEditing&&(
<div style={{display:'flex',gap:4,flexShrink:0}}>
<button type="button" onClick={()=>onEdit(widget)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:3,borderRadius:4}}><Settings size={12}/></button>
<button type="button" onClick={()=>onRemove(widget.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',padding:3,borderRadius:4}}><X size={12}/></button>
</div>
)}
</div>
{renderContent()}
</div>
)
}

export default function CustomDashboard(){
const[companyId,setCompanyId]=useState(null)
const[invoices,setInvoices]=useState([])
const[expenses,setExpenses]=useState([])
const[customers,setCustomers]=useState([])
const[bankAccounts,setBankAccounts]=useState([])
const[loading,setLoading]=useState(true)
const[widgets,setWidgets]=useState([])
const[isEditing,setIsEditing]=useState(false)
const[saving,setSaving]=useState(false)
const[showSidebar,setShowSidebar]=useState(false)
const[editingWidget,setEditingWidget]=useState(null)
const[activeId,setActiveId]=useState(null)
const navigate=useNavigate()

const sensors=useSensors(
useSensor(PointerSensor,{activationConstraint:{distance:8}}),
useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates})
)

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[invSnap,expSnap,custSnap,baSnap,layoutSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'expenses')),
getDocs(collection(db,'companies',cid,'customers')),
getDocs(collection(db,'companies',cid,'bankAccounts')),
getDoc(doc(db,'companies',cid,'_config','customDashboard')),
])
setInvoices(invSnap.docs.map(d=>({id:d.id,...d.data()})))
setExpenses(expSnap.docs.map(d=>({id:d.id,...d.data()})))
setCustomers(custSnap.docs.map(d=>({id:d.id,...d.data()})))
setBankAccounts(baSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.isActive!==false))
if(layoutSnap.exists()&&layoutSnap.data().widgets){
setWidgets(layoutSnap.data().widgets)
}else{
// Default widgets
setWidgets([
defaultWidget('revenue_card'),
{...defaultWidget('expense_card'),color:'#dc2626',bgColor:'rgba(220,38,38,0.06)'},
{...defaultWidget('profit_card'),color:'#16a34a',bgColor:'rgba(22,163,74,0.06)'},
defaultWidget('bar_chart'),
])
}
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

const handleSave=async()=>{
setSaving(true)
try{
await setDoc(doc(db,'companies',companyId,'_config','customDashboard'),{widgets,updatedAt:new Date().toISOString()})
alert('Dashboard saved ✓')
}catch(e){alert(e.message)}
setSaving(false)
}

const addWidget=(type)=>{
setWidgets(w=>[...w,defaultWidget(type)])
setShowSidebar(false)
}

const removeWidget=(id)=>setWidgets(w=>w.filter(x=>x.id!==id))

const updateWidget=(updated)=>{
setWidgets(w=>w.map(x=>x.id===updated.id?updated:x))
setEditingWidget(updated)
}

const handleDragStart=(e)=>setActiveId(e.active.id)

const handleDragEnd=(e)=>{
const{active,over}=e
setActiveId(null)
if(active.id!==over?.id){
setWidgets(items=>{
const oldIndex=items.findIndex(i=>i.id===active.id)
const newIndex=items.findIndex(i=>i.id===over.id)
return arrayMove(items,oldIndex,newIndex)
})
}
}

const data={invoices,expenses,customers,bankAccounts}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Custom Dashboard">

{/* Toolbar */}
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,gap:12,flexWrap:'wrap'}}>
<div style={{display:'flex',alignItems:'center',gap:8}}>
<h2 style={{fontSize:16,fontWeight:700}}>My Dashboard</h2>
<span style={{fontSize:11,color:'var(--text-3)',background:'#f1f5f9',padding:'2px 8px',borderRadius:20}}>{widgets.length} widgets</span>
</div>
<div style={{display:'flex',gap:8}}>
{isEditing&&(
<button type="button" onClick={()=>setShowSidebar(v=>!v)} className="btn btn-ghost" style={{fontSize:12}}>
<Plus size={14}/>Add Widget
</button>
)}
<button type="button" onClick={()=>setIsEditing(v=>!v)} className="btn btn-ghost" style={{fontSize:12,color:isEditing?'var(--primary)':'var(--text-2)'}}>
{isEditing?<Eye size={14}/>:<Settings size={14}/>}
{isEditing?'Preview':'Edit Layout'}
</button>
{isEditing&&(
<button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary" style={{fontSize:12}}>
<Save size={14}/>{saving?'Saving...':'Save Layout'}
</button>
)}
</div>
</div>

<div style={{display:'flex',gap:16,alignItems:'flex-start'}}>

{/* Widget Sidebar */}
{showSidebar&&isEditing&&(
<div style={{width:220,flexShrink:0,background:'white',borderRadius:14,border:'0.5px solid var(--border)',padding:16,boxShadow:'0 4px 16px rgba(0,0,0,0.06)'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
<span style={{fontSize:13,fontWeight:600}}>Widgets</span>
<button type="button" onClick={()=>setShowSidebar(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={14}/></button>
</div>
{['card','chart','table'].map(cat=>(
<div key={cat} style={{marginBottom:12}}>
<div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{cat}s</div>
{WIDGET_TYPES.filter(w=>w.category===cat).map(w=>(
<button key={w.type} type="button" onClick={()=>addWidget(w.type)} style={{
width:'100%',textAlign:'left',padding:'7px 10px',borderRadius:8,border:'0.5px solid var(--border)',
background:'#fafbff',cursor:'pointer',fontSize:12,marginBottom:4,
display:'flex',alignItems:'center',gap:8,color:'var(--text-1)',
}}>
<w.icon size={13} color="var(--primary)"/>{w.label}
</button>
))}
</div>
))}
</div>
)}

{/* Canvas */}
<div style={{flex:1}}>
{widgets.length===0?(
<div style={{padding:80,textAlign:'center',color:'var(--text-3)',background:'white',borderRadius:14,border:'1px dashed var(--border)'}}>
<Settings size={40} style={{margin:'0 auto 12px',opacity:0.2}}/>
<div style={{fontSize:15,fontWeight:500,marginBottom:8}}>No widgets yet</div>
<div style={{fontSize:13,marginBottom:16}}>Click "Edit Layout" then "Add Widget" to start</div>
<button type="button" onClick={()=>{setIsEditing(true);setShowSidebar(true)}} className="btn btn-primary"><Plus size={14}/>Add First Widget</button>
</div>
):(
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
<SortableContext items={widgets.map(w=>w.id)} strategy={rectSortingStrategy}>
<div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
{widgets.map(widget=>(
<SortableWidget
key={widget.id}
widget={widget}
onRemove={removeWidget}
onEdit={setEditingWidget}
data={data}
isEditing={isEditing}
/>
))}
</div>
</SortableContext>
<DragOverlay>
{activeId?(
<div style={{opacity:0.8,transform:'scale(1.02)',background:'white',borderRadius:14,padding:20,boxShadow:'0 8px 32px rgba(0,0,0,0.15)'}}>
<div style={{fontSize:13,fontWeight:600,color:'var(--primary)'}}>
{widgets.find(w=>w.id===activeId)?.title}
</div>
</div>
):null}
</DragOverlay>
</DndContext>
)}
</div>

{/* Edit Panel */}
{editingWidget&&isEditing&&(
<div style={{width:260,flexShrink:0,background:'white',borderRadius:14,border:'0.5px solid var(--border)',padding:16,boxShadow:'0 4px 16px rgba(0,0,0,0.06)'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
<span style={{fontSize:13,fontWeight:600}}>Widget Settings</span>
<button type="button" onClick={()=>setEditingWidget(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={14}/></button>
</div>

<div style={{display:'grid',gap:12}}>
<div>
<label style={{fontSize:11,fontWeight:600,color:'var(--text-3)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Title</label>
<input className="form-input" value={editingWidget.title} onChange={e=>updateWidget({...editingWidget,title:e.target.value})} style={{fontSize:12}}/>
</div>

<div>
<label style={{fontSize:11,fontWeight:600,color:'var(--text-3)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Size</label>
<select className="form-input" value={editingWidget.size||'medium'} onChange={e=>updateWidget({...editingWidget,size:e.target.value})} style={{fontSize:12}}>
<option value="small">Small (half)</option>
<option value="medium">Medium (half)</option>
<option value="large">Large (full width)</option>
</select>
</div>

<div>
<label style={{fontSize:11,fontWeight:600,color:'var(--text-3)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Year</label>
<input className="form-input" value={editingWidget.year||new Date().getFullYear()} onChange={e=>updateWidget({...editingWidget,year:e.target.value})} style={{fontSize:12}}/>
</div>

<div>
<label style={{fontSize:11,fontWeight:600,color:'var(--text-3)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Font Size</label>
<input className="form-input" type="number" min={10} max={32} value={editingWidget.fontSize||13} onChange={e=>updateWidget({...editingWidget,fontSize:Number(e.target.value)})} style={{fontSize:12}}/>
</div>

<div>
<label style={{fontSize:11,fontWeight:600,color:'var(--text-3)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Font Weight</label>
<select className="form-input" value={editingWidget.fontWeight||600} onChange={e=>updateWidget({...editingWidget,fontWeight:Number(e.target.value)})} style={{fontSize:12}}>
<option value={400}>Normal</option>
<option value={500}>Medium</option>
<option value={600}>Semi Bold</option>
<option value={700}>Bold</option>
</select>
</div>

<div>
<label style={{fontSize:11,fontWeight:600,color:'var(--text-3)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Title Color</label>
<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
{DEFAULT_COLORS.map(c=>(
<button key={c} type="button" onClick={()=>updateWidget({...editingWidget,color:c})} style={{width:20,height:20,borderRadius:'50%',background:c,border:editingWidget.color===c?'2px solid #1a1d2e':'2px solid transparent',cursor:'pointer'}}/>
))}
</div>
<input type="color" value={editingWidget.color||'#4F6EF7'} onChange={e=>updateWidget({...editingWidget,color:e.target.value})} style={{width:'100%',height:32,borderRadius:8,border:'0.5px solid var(--border)',cursor:'pointer'}}/>
</div>

<div>
<label style={{fontSize:11,fontWeight:600,color:'var(--text-3)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Background Color</label>
<input type="color" value={editingWidget.bgColor?.replace(/[^#\w]/g,'')||'#f0f4ff'} onChange={e=>updateWidget({...editingWidget,bgColor:e.target.value+'22'})} style={{width:'100%',height:32,borderRadius:8,border:'0.5px solid var(--border)',cursor:'pointer'}}/>
</div>

{(editingWidget.type==='line_chart'||editingWidget.type==='bar_chart'||editingWidget.type==='pie_chart'||editingWidget.type==='donut_chart')&&(
<>
<div>
<label style={{fontSize:11,fontWeight:600,color:'var(--text-3)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Chart Color 1 (Revenue)</label>
<input type="color" value={editingWidget.chartColor1||'#4F6EF7'} onChange={e=>updateWidget({...editingWidget,chartColor1:e.target.value})} style={{width:'100%',height:32,borderRadius:8,border:'0.5px solid var(--border)',cursor:'pointer'}}/>
</div>
<div>
<label style={{fontSize:11,fontWeight:600,color:'var(--text-3)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Chart Color 2 (Expense)</label>
<input type="color" value={editingWidget.chartColor2||'#ef4444'} onChange={e=>updateWidget({...editingWidget,chartColor2:e.target.value})} style={{width:'100%',height:32,borderRadius:8,border:'0.5px solid var(--border)',cursor:'pointer'}}/>
</div>
<div>
<label style={{fontSize:11,fontWeight:600,color:'var(--text-3)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Chart Color 3</label>
<input type="color" value={editingWidget.chartColor3||'#16a34a'} onChange={e=>updateWidget({...editingWidget,chartColor3:e.target.value})} style={{width:'100%',height:32,borderRadius:8,border:'0.5px solid var(--border)',cursor:'pointer'}}/>
</div>
</>
)}
</div>
</div>
)}
</div>

</Layout>
)
}
