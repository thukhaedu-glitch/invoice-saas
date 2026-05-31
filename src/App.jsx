import{BrowserRouter,Routes,Route,Navigate}from"react-router-dom"
import{useEffect,useState}from"react"
import{auth}from"./firebase"
import{onAuthStateChanged}from"firebase/auth"
import Login from"./pages/Login"
import Dashboard from"./pages/Dashboard"
export default function App(){
const[user,setUser]=useState(null)
const[loading,setLoading]=useState(true)
useEffect(()=>{return onAuthStateChanged(auth,u=>{setUser(u);setLoading(false)})},[])
if(loading)return<div>Loading...</div>
return<BrowserRouter><Routes><Route path="/login" element={!user?<Login/>:<Navigate to="/"/>}/><Route path="/*" element={user?<Dashboard/>:<Navigate to="/login"/>}/></Routes></BrowserRouter>
}
