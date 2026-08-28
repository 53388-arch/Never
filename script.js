// ===== SUPABASE SETUP =====
const SUPABASE_URL = "https://ivipprtesqkidlulwlmh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_khgkWHLRG8s_365dgq9P-g_XsCzrBKQ";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let books = [];
let categories = ["ทั้งหมด"];
let activeCategory = "ทั้งหมด";
let query = "";
let sortBy = "title";

async function loadBooks(){
  const { data, error } = await sb
    .from('books')
    .select('*')
    .order('title', { ascending: true });

  console.log('SUPABASE RESULT →', { data, error }); // ลบทิ้งได้หลัง debug เสร็จ

  if(error){
    document.getElementById('grid').innerHTML =
      `<div class="empty">โหลดข้อมูลไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  books = data.map(b => ({
    id: b.id,
    title: b.title,
    author: b.author,
    category: b.category,
    call: b.call_number,
    borrowed: b.borrowed,
    due: b.due_date
  }));

  categories = ["ทั้งหมด", ...Array.from(new Set(books.map(b=>b.category)))];
  renderDrawers();
  renderGrid();
}

function addDays(days){
  const d = new Date();
  d.setDate(d.getDate()+days);
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}`;
}

function renderDrawers(){
  const nav = document.getElementById('drawers');
  nav.innerHTML = categories.map(cat => {
    const count = cat === "ทั้งหมด" ? books.length : books.filter(b=>b.category===cat).length;
    return `<div class="drawer-tab ${cat===activeCategory?'active':''}" data-cat="${cat}">${cat}<span class="count">${count}</span></div>`;
  }).join('');
  nav.querySelectorAll('.drawer-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      activeCategory = tab.dataset.cat;
      renderDrawers();
      renderGrid();
    });
  });
}

function stampSVG(dueText){
  return `<svg viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
    <circle cx="70" cy="70" r="62" fill="none" stroke="#8C3A32" stroke-width="3.5" opacity="0.85"/>
    <circle cx="70" cy="70" r="52" fill="none" stroke="#8C3A32" stroke-width="1.4" opacity="0.6"/>
    <text x="70" y="58" text-anchor="middle" fill="#8C3A32" font-size="14" font-family="IBM Plex Mono, monospace" font-weight="700" opacity="0.9">ยืมแล้ว</text>
    <text x="70" y="78" text-anchor="middle" fill="#8C3A32" font-size="9" font-family="IBM Plex Mono, monospace" opacity="0.85">DUE</text>
    <text x="70" y="92" text-anchor="middle" fill="#8C3A32" font-size="9.5" font-family="IBM Plex Mono, monospace" font-weight="600" opacity="0.9">${dueText}</text>
  </svg>`;
}

function renderGrid(){
  const grid = document.getElementById('grid');
  let list = books.filter(b=>{
    const matchCat = activeCategory==="ทั้งหมด" || b.category===activeCategory;
    const q = query.trim().toLowerCase();
    const matchQuery = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    return matchCat && matchQuery;
  });

  list.sort((a,b)=>{
    if(sortBy==="status") return (a.borrowed===b.borrowed)?0:(a.borrowed?1:-1);
    return (a[sortBy]||"").localeCompare(b[sortBy]||"", 'th');
  });

  if(list.length===0){
    grid.innerHTML = `<div class="empty">ไม่พบหนังสือที่ค้นหา — ลองคำอื่นหรือเปลี่ยนหมวดหมู่</div>`;
  } else {
    grid.innerHTML = list.map(b => `
      <div class="card" data-id="${b.id}">
        <div class="call-no">${b.call||''}</div>
        <h3>${b.title}</h3>
        <p class="author">โดย ${b.author}</p>
        <div class="tag-row"><span class="tag">${b.category}</span></div>
        <div class="status-row">
          <span class="status-dot ${b.borrowed?'out':''}">${b.borrowed ? 'ถูกยืมอยู่' : 'พร้อมให้ยืม'}</span>
          <button class="action ${b.borrowed?'return':''}" data-id="${b.id}">${b.borrowed ? 'คืนหนังสือ' : 'ยืมหนังสือ'}</button>
        </div>
        <div class="stamp ${b.borrowed?'show':''}">${stampSVG(b.due||'')}</div>
      </div>
    `).join('');
  }

  grid.querySelectorAll('button.action').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = Number(btn.dataset.id);
      const book = books.find(x=>x.id===id);
      const newBorrowed = !book.borrowed;
      const newDue = newBorrowed ? addDays(14) : null;

      btn.disabled = true;
      const { error } = await sb
        .from('books')
        .update({ borrowed: newBorrowed, due_date: newDue })
        .eq('id', id);
      btn.disabled = false;

      if(error){ alert('อัปเดตไม่สำเร็จ: ' + error.message); return; }

      book.borrowed = newBorrowed;
      book.due = newDue;
      renderDrawers();
      renderGrid();
      renderStats();
    });
  });

  renderStats();
}

function renderStats(){
  document.getElementById('statTotal').textContent = books.length;
  document.getElementById('statAvail').textContent = books.filter(b=>!b.borrowed).length;
  document.getElementById('statOut').textContent = books.filter(b=>b.borrowed).length;
}

document.getElementById('searchBox').addEventListener('input', e=>{
  query = e.target.value;
  renderGrid();
});
document.getElementById('sortSelect').addEventListener('change', e=>{
  sortBy = e.target.value;
  renderGrid();
});

function tickClock(){
  const d = new Date();
  document.getElementById('clock').textContent = d.toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' });
}
tickClock();

// realtime: อัปเดตอัตโนมัติเมื่อมีคนอื่นแก้ข้อมูล
sb
  .channel('books-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, loadBooks)
  .subscribe();

loadBooks();