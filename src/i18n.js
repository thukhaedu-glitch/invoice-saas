import i18n from'i18next'
import{initReactI18next}from'react-i18next'

// ==== Translation strings ====
// အသစ်ထည့်ရင် ၂ ဘာသာလုံး (en + my) ထည့်ပါ
const resources={
en:{translation:{
// common
save:'Save',cancel:'Cancel',delete:'Delete',edit:'Edit',add:'Add',search:'Search',
loading:'Loading...',back:'Back',close:'Close',confirm:'Confirm',yes:'Yes',no:'No',
// nav
dashboard:'Dashboard',invoices:'Invoices',quotations:'Quotations',contracts:'Contracts',
customers:'Customers',expenses:'Expenses',projects:'Projects',usage:'Usage',billing:'Billing',
settings:'Settings',profile:'Profile',logout:'Logout',
// subscription
upgrade:'Upgrade',current_plan:'Current Plan',change_plan:'Change Plan',
cancel_subscription:'Cancel Subscription',resubscribe:'Resubscribe',
expiring_today:'Subscription expires today!',
expiring_days:'Subscription expires in {{days}} days',
please_resubscribe:'Please resubscribe',
valid_until:'Valid until',
// plan limit
limit_reached:'Limit reached',
upgrade_required:'Upgrade Required',
upgrade_to_continue:'Upgrade your plan to use this feature.',
}},
my:{translation:{
// common
save:'သိမ်းမည်',cancel:'ပယ်ဖျက်',delete:'ဖျက်',edit:'ပြင်',add:'ထည့်',search:'ရှာ',
loading:'ခဏစောင့်ပါ...',back:'နောက်သို့',close:'ပိတ်',confirm:'အတည်ပြု',yes:'ဟုတ်',no:'မဟုတ်',
// nav
dashboard:'ပင်မစာမျက်နှာ',invoices:'ပြေစာများ',quotations:'စျေးနှုန်းများ',contracts:'စာချုပ်များ',
customers:'ဖောက်သည်များ',expenses:'အသုံးစရိတ်',projects:'စီမံကိန်းများ',usage:'အသုံးပြုမှု',billing:'ငွေတောင်းခံ',
settings:'ဆက်တင်',profile:'ပရိုဖိုင်',logout:'ထွက်မည်',
// subscription
upgrade:'Plan မြှင့်တင်',current_plan:'လက်ရှိ Plan',change_plan:'Plan ပြောင်း',
cancel_subscription:'Subscription ပယ်ဖျက်',resubscribe:'ပြန်လည်စာရင်းသွင်း',
expiring_today:'Subscription ဒီနေ့ ကုန်ဆုံးမယ်!',
expiring_days:'Subscription {{days}} ရက်အတွင်း ကုန်ဆုံးမယ်',
please_resubscribe:'ကျေးဇူးပြု၍ ပြန်လည်စာရင်းသွင်းပါ',
valid_until:'သက်တမ်း',
// plan limit
limit_reached:'ကန့်သတ်ချက် ပြည့်ပါပြီ',
upgrade_required:'Plan မြှင့်တင်ရန် လိုအပ်ပါသည်',
upgrade_to_continue:'ဒီ feature သုံးရန် plan မြှင့်တင်ပါ။',
}},
}

// browser/localStorage ကနေ language ယူ (default: en)
const saved=typeof window!=='undefined'?localStorage.getItem('lang'):null

i18n.use(initReactI18next).init({
resources,
lng:saved||'en',
fallbackLng:'en',
interpolation:{escapeValue:false},
})

export default i18n
