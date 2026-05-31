import{useState}from'react'
import{auth}from'../firebase'
import{signOut}from'firebase/auth'
import{useLocation,useNavigate}from'react-router-dom'
import{FileText,FileCheck,ScrollText,Users,Wallet,Briefcase,BarChart2,User,Settings,LogOut,Menu,X}from'lucide-react'
const navItems=[
{path:'/',label:'Invoices',icon:FileText},
{path:'/quotations',label:'Quotations',icon:FileCheck},
{path:'/contracts',label:'Contracts',icon:ScrollText},
{path:'/customers',label:'Customers',icon:Users},
{path:'/expenses',label:'Expenses',icon:Wallet},
{path:'/projects',label:'Projects',icon:Briefcase},
{path:'/reports',label:'Reports',icon:BarChart2},
]
export default function Layout({children,title}){
const[open,setOpen]=useState(false)
const location=useLocation()
const navigate=useNavigate()
return(
<div style={{display:'flex',minHeight:'100vh'}}>
{open&&<div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:98}}/>}
<aside className={`sidebar${open?' open':''}`}>
<div style={{padding:'20px 18px 16px',borderBottom:'0.5px solid var(--border)'}}>
<div style={{display:'flex',alignItems:'center',gap:10}}>
<div style={{width:34,height:34,background:'var(--primary)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
<FileText size={18} color="#fff"/>
</div>
<div>
<div style={{fontWeight:600,fontSize:14,color:'var(--text-1)'}}>Invoice SaaS</div>
<div style={{fontSize:10,color:'var(--text-3)',marginTop:1}}>{auth.currentUser?.email}</div>
</div>
</div>
</div>
<nav style={{flex:1,padding:'12px 10px',overflowY:'auto'}}>
<div style={{fontSize:10,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',padding:'8px 8px 4px'}}>Main</div>
{navItems.map(({path,label,icon:Icon})=>(
<div key={path} className={`nav-item${location.pathname===path?' active':''}`} onClick={()=>{navigate(path);setOpen(false)}}>
<Icon size={17}/><span>{label}</span>
</div>
))}
<div style={{fontSize:10,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',padding:'12px 8px 4px',marginTop:8}}>Account</div>
<div className="nav-item" onClick={()=>{navigate('/profile');setOpen(false)}}>
<User size={17}/><span>Profile</span>
</div>
<div className="nav-item" onClick={()=>{navigate('/settings');setOpen(false)}}>
<Settings size={17}/><span>Settings</span>
</div>
</nav>
<div style={{padding:10,borderTop:'0.5px solid var(--border)'}}>
<div className="nav-item" style={{color:'#ef4444'}} onClick={()=>signOut(auth)}>
<LogOut size={17}/><span>Logout</span>
</div>
</div>
</aside>
<div className="main-area">
<div className="topbar">
<button id="hamburger" onClick={()=>setOpen(v=>!v)} className="btn btn-ghost" style={{padding:'6px 8px'}}>
{open?<X size={18}/>:<Menu size={18}/>}
</button>
<div style={{flex:1,fontWeight:500,fontSize:15,color:'var(--text-1)'}}>{title}</div>
<span style={{fontSize:11,background:'var(--primary-light)',color:'var(--primary)',padding:'3px 10px',borderRadius:20,fontWeight:600}}>Free</span>
</div>
<div className="page-content">{children}</div>
</div>
</div>
)
}
