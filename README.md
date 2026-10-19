# Assemble Office

เว็บออฟฟิศเสมือนสำหรับองค์กร: พบเพื่อนร่วมงาน เห็นความพร้อม และเข้าห้องประชุมจากเบราว์เซอร์บนคอมพิวเตอร์ แผนที่เป็นภาพพิกเซลที่สร้างใหม่ แยกพื้นและเฟอร์นิเจอร์ ส่วนตัวละครและรูปโปรไฟล์ใช้ sprite ของ ZEP ที่ดาวน์โหลดตามคำขอ พร้อมรองรับข้อมูลตัวละครชุดเดิม

## พรีวิวให้ทีมผ่าน ngrok

โหมด dev ปกติจำกัดไว้ที่ localhost การเปิดผ่านโดเมน ngrok จึงขึ้น `Blocked request` แม้ forward พอร์ตถูกแล้ว ใช้โหมดพรีวิวสำหรับทีมแทน โหมดนี้ให้บริการไฟล์ที่ build แล้ว มีรหัสผ่านก่อนเข้าเว็บ และอนุญาต Origin/WebSocket ตาม URL ที่ระบุ โดยไม่เปิด Vite dev server ออกไป

1. หยุดเซิร์ฟเวอร์ Assemble เดิมด้วย Ctrl+C ก่อน เพื่อคืนพอร์ต 4173
2. เปิด ngrok บนเครื่องเดียวกับเซิร์ฟเวอร์ แล้วคัดลอก HTTPS URL:

```sh
ngrok http 4173
```

3. บน Windows เปิด PowerShell อีกหน้าต่างในโฟลเดอร์โปรเจกต์:

```powershell
.\start-demo.ps1 -PreviewOrigin https://nearby-awning-outing.ngrok-free.dev
```

หรือบน Mac/Linux ที่ติดตั้ง Node.js และ pnpm แล้ว:

```sh
pnpm build
pnpm preview:tunnel https://nearby-awning-outing.ngrok-free.dev
```

เปลี่ยน URL เป็นค่าที่ ngrok แสดงจริง คำสั่งจะสุ่มรหัสพรีวิวแล้วแสดงใน Terminal ส่ง URL และรหัสเฉพาะผู้ทดลอง เปิด URL HTTPS ใส่รหัส แล้วเลือกชื่อทดลองเพื่อเข้าออฟฟิศ เมื่อ URL เปลี่ยนต้องเริ่มโหมดพรีวิวใหม่ด้วย URL ใหม่

พรีวิวใช้ `data/tunnel-preview.sqlite` แยกจาก `data/office.sqlite`; บัญชีแรกเป็นผู้ดูแล และผู้ถือรหัสกลับเข้าชื่อทดลองเดิมได้ จึงเหมาะกับกลุ่มทดสอบที่ไว้ใจกัน ไม่ใช่ระบบยืนยันตัวตนสำหรับองค์กร รหัสเข้าพรีวิวใช้ผ่าน cookie แบบ HttpOnly/Secure อายุ 4 ชั่วโมง เปลี่ยนรหัสหรือเริ่ม launcher ใหม่โดยไม่ตั้งรหัสคงที่เพื่อยกเลิก cookie เดิม ตั้ง `PREVIEW_PASSWORD` อย่างน้อย 16 ตัวอักษรเฉพาะเมื่อต้องการกำหนดรหัสเอง

ngrok พอร์ต 4173 เปิดเฉพาะเว็บและ WebSocket ไม่ได้เปิดเส้นทางเสียง/วิดีโอของ LiveKit ตามไปด้วย หากใช้จากเครื่องอื่น `LIVEKIT_URL` ต้องเป็น endpoint ที่เครื่องผู้เข้าร่วมเข้าถึงได้ผ่าน WSS และต้องตั้งพอร์ตสื่อตามคู่มือ LiveKit; `ws://localhost:7880` ใช้ได้เฉพาะผู้เปิดเบราว์เซอร์บนเครื่อง LiveKit เอง

## เริ่มเดโมในเครื่อง

บนเครื่องที่สร้างโปรเจกต์นี้ เปิด PowerShell ในโฟลเดอร์โปรเจกต์ แล้วรัน:

```powershell
.\start-demo.ps1
```

เปิด **http://localhost:4173** ใส่ชื่อแล้วเข้าออฟฟิศ ผู้ใช้เดโมคนแรกเป็นผู้ดูแล การใช้ชื่อเดิมจะกลับเข้าบัญชีเดโมเดิม โหมดนี้เป็นการจำลองตัวตนสำหรับการทดลองในเครื่องเท่านั้น

ทดลองสองคนด้วย `http://localhost:4173` และ `http://127.0.0.1:4173` ซึ่งใช้ cookies คนละ host หรือใช้หน้าต่างไม่ระบุตัวตน ข้อมูลที่ออนไลน์มาจากการเชื่อมต่อจริง ไม่มีผู้เล่นจำลอง

เครื่องอื่นต้องใช้ **Node.js >=24.15** และ pnpm:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
```

ตรวจโค้ดและไฟล์สำหรับ production:

```sh
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm check:production
```

`pnpm format` จัดรูปแบบ source ด้วย Prettier ส่วน `check:production` เปิดเซิร์ฟเวอร์ production ชั่วคราวและตรวจหน้าเว็บ ภาพแผนที่ เฟอร์นิเจอร์ และตัวละคร โดยแยกฐานข้อมูลออกจากข้อมูลเดิม Docker build รวมไฟล์ `public/` เพื่อให้ภาพทั้งหมดอยู่ใน `dist/` ด้วย

ไฟล์ฐานข้อมูล `.env`, dependencies, build output และ snapshot โค้ด third-party ที่ใช้วิเคราะห์ถูกแยกออกจาก Git; ตัวอย่างค่าตั้งค่าอยู่ใน `.env.example` กราฟิก ZEP มีที่มาและข้อจำกัดสิทธิ์ใน `public/characters/zep/NOTICE.txt`

## สิ่งที่ใช้งานได้ในเดโม

- ตำแหน่งผู้ใช้หลายคนผ่าน WebSocket เซิร์ฟเวอร์ตรวจความเร็วและการชนกับผนัง/เฟอร์นิเจอร์
- เดินสี่ทิศบนกริด 24 พิกเซลด้วยลูกศรหรือ WASD; กดสั้นขยับหนึ่งช่อง ปล่อยปุ่มแล้วเดินให้จบช่อง และเปลี่ยนทิศที่กลางช่อง
- คลิกพื้นเพื่อหาเส้นทางบนกริดเดียวกัน จุดเกิด ประตู และที่นั่งยึดกลางช่อง; ปุ่มกริดข้างตัวซูมใช้แสดงช่องเดิน
- ภาพเคลื่อนต่อเนื่องระหว่างช่องตามจังหวะหน้าจอ โดยเซิร์ฟเวอร์ตรวจเส้นทางและการชนเต็มช่วงที่ก้าวผ่าน รวมทั้งกันการเข้าห้องเต็มก่อนเริ่มก้าว
- รายชื่อออนไลน์/ออฟไลน์ ค้นหาสมาชิก และสถานะพร้อมคุย / โฟกัส / ไม่อยู่ / อยู่ที่ออฟฟิศ
- จองที่นั่งประจำแบบไม่ซ้ำ และกลับไปที่นั่งของตัวเอง
- แชตส่วนกลางและแชตเฉพาะผู้ที่อยู่ในห้อง ข้อความเก็บ 30 วันและลบตามอายุอัตโนมัติ
- ห้อง Bloom และ Orbit ห้องละ 8 คน; จำนวนออนไลน์รวม 20 คนและสมาชิก 50 คนเป็นเพดานกลุ่มทดลอง
- คำเชิญแขกอายุ 24 ชั่วโมง แขกเข้าถึงได้เฉพาะห้องที่ได้รับเชิญ ยกเลิกคำเชิญได้
- ผู้ดูแลถอนสิทธิ์สมาชิกได้ พร้อมยกเลิกเซสชัน ที่นั่ง และคำเชิญที่สมาชิกนั้นสร้าง
- รีแอ็กชันและแผนผังซูมได้
- ตัวละคร ZEP ยืนและเดิน 4 ทิศ เลือกผม 117 แบบ เสื้อผ้า 83 แบบ ใบหน้า 80 แบบ ผิว 13 แบบ แว่น 13 แบบ และสีที่มีในแต่ละแบบ จากโปรไฟล์ของฉัน
- พรีวิวหน้าตาและท่าเดินก่อนบันทึก ตัวเลือกบันทึกในบัญชีและส่งให้เพื่อนร่วมงานทันที รูปในรายชื่อ แชต และห้องประชุมใช้ตัวละครเดียวกัน ผู้เยี่ยมชมเก็บตัวเลือกตลอดอายุเซสชันคำเชิญ

## แผนที่ออฟฟิศ

แผนที่ pixel-office สร้างใหม่ด้วย built-in ImageGen ตาม workflow generate2dmap แบบ `scene_mode / layered_raster / y_sorted_props / precise_shapes / project-native` เพื่อให้ขนาดโต๊ะ เก้าอี้ ต้นไม้ และลายเส้นสอดคล้องกับตัวละคร ZEP ขนาด 48×64 พิกเซล พื้น 1344×960 มีเฉพาะไม้และพรม ส่วนเฟอร์นิเจอร์ 10 assets เป็น PNG โปร่งใส แยกเป็นวัตถุ runtime 69 ชิ้น รวมผนังแบ่งห้อง ต้นไม้ โต๊ะทำงาน โต๊ะประชุม โซฟา ชั้นหนังสือ และมุมกาแฟ

ภาพต้นฉบับ พื้น ภาพอ้างอิง พรอมป์ต์ แผนการผลิต และภาพรวมอยู่ใน `assets/map/pixel-office/` ภาพเฟอร์นิเจอร์ต้นฉบับและพรอมป์ต์แต่ละชิ้นอยู่ใน `assets/props/pixel-office/` ไฟล์ runtime อยู่ใน `public/maps/pixel-office/` ภาพ `dressed-reference.png` เป็นภาพอ้างอิงสำหรับวางแผนเท่านั้น runtime ใช้ `base.png` และ PNG แยกชิ้นจริง

`shared/office-scene.js` อ้างอิงตำแหน่งโต๊ะ ห้อง ผนัง ต้นไม้ และ collision จาก `shared/world.js` โดยตรง วาดวัตถุกับผู้เล่นตามพิกัด y ของฐาน แผนที่ export มี collision, walk bounds, camera bounds, จุดเกิด, ที่นั่ง และช่องประตูห้อง ไม่อนุมานพื้นที่ชนจากพิกเซลภาพ เพิ่มระยะระหว่างแถวโต๊ะ 24 พิกเซลเพื่อเว้นพื้นที่ตัวละครและป้ายที่นั่ง จุดเกิด ประตู และทั้ง 10 ที่นั่งผ่านการตรวจเส้นทางแล้ว

ส่งออกข้อมูลและจัดขนาดภาพที่สร้างไว้ใหม่ (ต้องมี Pillow):

```sh
node scripts/export-office-scene.mjs
python scripts/prepare-office-map.py
```

สคริปต์จัดภาพครอปเฉพาะ alpha วัตถุ ลบ halo โปร่งบาง ปรับขนาดด้วย nearest-neighbor และประกอบภาพ QA โดยไม่วาด final art ขึ้นเอง ผลตรวจ alpha/ขนาดอยู่ใน `assets/map/pixel-office/asset-validation.json` ภาพรวม `layered-preview.png` ขนาด 1344×960 และผลตรวจ browser อยู่ใน `browser-verification.json` ภาพหน้าจอจริงอยู่ใน `docs/preview/pixel-office-desktop.png`, `pixel-office-grid.png` และ `pixel-office-mobile.png`

เทสต์ `tests/office-scene.test.mjs` ตรวจว่าไฟล์ runtime มีจริง มี alpha มี prompt และ collision/ที่นั่ง/ประตูตรงกับ server geometry; `tests/browser-office-map.mjs` ทดสอบภาพโหลดครบ การเดินหน้า–หลังต้นไม้ การจองและกลับที่นั่ง การเปิดห้อง และกริด โดยใช้ Chrome กับฐานข้อมูลชั่วคราวแยกจากบัญชีเดิม การตรวจเต็มล่าสุดผ่าน 36 tests, TypeScript และ Vite build พร้อม browser-map-controls ที่ตรวจ wheel zoom, WASD ภาษาไทย และการเดินทแยง

## ชุดภาพตัวละคร

ชุดเริ่มต้นปัจจุบันใช้ ZEP catalog ที่ดาวน์โหลดเมื่อ 19 ตุลาคม 2026 ตามคำขอของเจ้าของ workspace ไฟล์ PNG 2,224 ไฟล์ (25,714,774 ไบต์) อยู่ใน `public/characters/zep/` แบ่งเป็น skin 13, face 96, clothes 888, hair 1,214 และ glasses 13 รวมสีทั้งหมดแล้ว หมวด mask ไม่มีรายการใน catalog ชุดนี้ ไม่ได้หมายถึงสินทรัพย์ทั้งหมดของบริการ ZEP

ภาพต้นฉบับ 432×256 เก็บครบ 36 เฟรม เฟรมละ 48×64 ใช้ Canvas รวมชั้น skin → face → clothes → hair → mask → glasses แล้วจัด 20 เฟรมแรกเป็น 4 แถวทิศทาง แถวละ 5 ช่อง (ยืน 1 + เดิน 4) สำหรับ renderer ของ Assemble การเปลี่ยนสีเลือก part ID ของภาพจริง ไม่มีการย้อมสีทับ ชุดมาตรฐานใช้ 8 fps

หน้าแต่งตัวแบ่งหมวดและหน้า พร้อมภาพตัวอย่างและสี บันทึก part IDs แบบ `{ source: 'zep', skin, face, clothes, hair, mask, glasses }` โดยใช้ catalog เดียวกันตรวจค่าทั้ง client/server ตัวเลือกเดิมยังอ่านและแสดงได้ เปิดหน้าแต่งตัวแล้วกดบันทึกเพื่อเปลี่ยนบัญชีเดิมเป็นชุด ZEP บัญชีที่ยังไม่เคยตั้งตัวละครใช้ชุด ZEP เริ่มต้นตาม user ID

`scripts/download-zep-avatars.mjs` ดาวน์โหลดจาก catalog ที่เก็บใน `research/zep-avatar/catalog.json` และข้ามไฟล์เดิมที่ตรวจผ่าน ตรวจลายเซ็น PNG, ขนาด และบันทึก SHA-256 พร้อม URL ต้นทางใน `research/zep-avatar/download-results.json` ตัวเลือกที่โหลดสำเร็จอยู่ใน `shared/zep-catalog.json` รูปโหลดจากไฟล์ในเครื่องโดยไม่มีการเรียก ZEP ขณะใช้งานเว็บ

กราฟิกนี้เป็นของบุคคลภายนอก ยังไม่ได้ตรวจพบ license อนุญาตใช้หรือแจกจ่ายภายนอก ZEP หมวด free/purchase ใน catalog ไม่ใช่ license ของ Assemble เก็บที่มาและสถานะไว้ใน `public/characters/zep/NOTICE.txt` และรายงาน `research/zep-avatar/report.html`

ตรวจด้วย `node --test tests/*.test.mjs` (33 tests), TypeScript, Vite build และ `tests/browser-zep-integration.mjs` ซึ่งทดสอบ Chrome จริง: เดิน 4 ทิศแม้ reduced motion, เลือกแบบ/สี/แว่น, บันทึกและโหลดกลับ และเดินบนแผนที่ ภาพหน้าจอ desktop/mobile อยู่ใน `docs/preview/zep-integrated*.png` ผลตรวจใน `research/zep-avatar/integration-verification.json`

### ชุดเดิมที่สร้างสำหรับโครงการ

ชุดก่อนหน้าเป็นตัวละครที่สร้างใหม่ด้วย built-in ImageGen โดยอ้างอิงรูปลักษณ์ ZEP จาก `research/zep-fingw/initial.png`: หัวกลมใหญ่ ลำตัวสั้นประมาณสองช่วงหัว ใบหน้าเรียบง่าย และเส้นขอบเข้ม ภาพต้นฉบับและพรอมป์ต์อยู่ใน `assets/characters/v2/source/` ส่วน `assets/characters/v2/processed/` เก็บเฉพาะ `pipeline-meta.json` ของแต่ละตัวที่สคริปต์ใช้จัดเฟรมและตรวจขอบภาพตาม workflow ของ `generate2dsprite` ภาพระหว่างประมวลผลที่ไม่ได้ใช้ถูกลบแล้ว ไฟล์ชุดเดิมยังอยู่ใน `public/characters/` เป็นหัว 4 แบบ ลำตัว 3 แบบ และ mask สำหรับเปลี่ยนสีโดยรักษาแสงเงา

ภาพรวมตัวเลือกอยู่ใน `assets/characters/v2/layer-contact-sheet.png` และ GIF จากชิ้นส่วนสุดท้ายอยู่ใน `assets/characters/v2/walk-*.gif` การเปลี่ยนสีคงดวงตาและเส้นขอบสีเข้มไว้ และการลบพื้นหลังจำกัดเฉพาะ magenta เพื่อไม่ให้สีกางเกงม่วงกลายเป็นรูโปร่งใส

รูปแบบ sprite sheet ใช้เฟรม 48×64 พิกเซล 4 คอลัมน์ × 4 ทิศ (down, left, right, up) และ 8 fps ตาม API `App.loadSpritesheet` ของ ZEP โดยแต่ละทิศกำหนดรายการเฟรมเองได้ บนแผนที่ใช้ `public/characters/native/` ขนาดจริง ส่วนโปรไฟล์และพรีวิวใช้ master 3 เท่า (เฟรม 144×192) ไฟล์ PNG รวมทั้งตัวที่พร้อมโหลดเข้า ZEP และตัวอย่าง `main.js` อยู่ใน `assets/characters/zep/` เป็นตัวละครที่สร้างสำหรับโปรเจกต์นี้

`scripts/prepare-characters.py` ประมวลผลภาพที่สร้างไว้ด้วย Pillow: ลบพื้น magenta, ย่อจากต้นฉบับโดยตรงแบบ nearest-neighbor, จัดรอยต่อคอและระดับเท้า, ตัดเฉพาะพื้นที่โปร่งใสด้านข้างให้ได้สัดส่วน 48:64, แยกชั้นภาพ และสร้าง mask โดยไม่วาดตัวละครขึ้นใหม่ เก็บรายละเอียด 3 เท่าสำหรับรูปโปรไฟล์และพรีวิว ไม่ขยายจากไฟล์ native ที่ย่อแล้ว รันหลังขั้น process ของ generate2dsprite เมื่อต้องส่งออกชุดภาพเดิมใหม่:

```sh
python scripts/prepare-characters.py
python tests/check-character-assets.py
```

เฟรมเดินของตัวละครใช้ requestAnimationFrame แยกจากเอฟเฟกต์ตกแต่ง CSS เพื่อให้ขาขยับขณะเดินและในพรีวิว แม้เปิด reduced motion อยู่ ปุ่มหยุดเดินยังคืนเฟรมยืนได้ตามปกติ `tests/browser-character-regression.mjs` ตรวจตำแหน่งเฟรมจาก DOM ของหน้าจอจริงผ่าน cua_repl ได้

ค่าปรับแต่งและการตรวจตัวเลือกอยู่ใน `shared/appearance.js` ฐานข้อมูลรุ่นเดิมเพิ่มคอลัมน์แบบ additive เมื่อเปิดเซิร์ฟเวอร์ครั้งถัดไป สมาชิกเดิมได้ตัวเริ่มต้นที่คงเดิมตาม user ID

SQLite อยู่ใน `data/office.sqlite` ซึ่งถูก ignore ไว้ หยุดเซิร์ฟเวอร์ก่อนย้าย/สำรองฐานข้อมูลพร้อมไฟล์ WAL ที่ยังมีอยู่ ตัวตนเดโมไม่เชื่อมกับบุคลากรจริง

## เชื่อมบัญชีบริษัท

คัดลอก `.env.example` เป็น `.env` ตั้งค่า:

- `AUTH_MODE=oidc`
- `PUBLIC_ORIGIN` เป็น HTTPS origin ของระบบจริง
- `ALLOWED_DOMAINS` เป็นโดเมนอีเมลที่อนุญาต คั่นด้วย comma
- `ADMIN_EMAILS` เป็นอีเมลผู้ดูแลที่แน่นอน คั่นด้วย comma
- `SESSION_SECRET` เป็นค่าสุ่มอย่างน้อย 32 ตัวอักษร

สำหรับ Google ตั้ง `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` และลงทะเบียน redirect URI:

```text
https://your-office.example/auth/google/callback
```

สำหรับ Microsoft ตั้ง `MICROSOFT_TENANT_ID` เป็น tenant GUID ขององค์กร พร้อม `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` และ redirect URI:

```text
https://your-office.example/auth/microsoft/callback
```

ระบบใช้ Authorization Code + PKCE, state, nonce, ID token validation, โดเมนอีเมล และ tenant ของ Microsoft โดยใช้ openid-client ผู้ให้บริการจะแสดงบนหน้าเข้าสู่ระบบเมื่อมี config ครบ การเชื่อมต่อบัญชีจริงยังต้องทดสอบกับแอปและ tenant ขององค์กร

## เชื่อมเสียง วิดีโอ และแชร์หน้าจอ

กำหนด `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` ของ LiveKit ที่องค์กรเลือกใช้ ระบบออก token ที่เซิร์ฟเวอร์เฉพาะผู้ที่อยู่ในห้องนั้น ใช้ React VideoConference และเริ่มด้วยไมค์/กล้องปิดอยู่ เสียง วิดีโอ และแชร์หน้าจอจะเปิดใช้ได้เมื่อเชื่อมบริการแล้ว

เมื่อยังไม่มี config หน้าจอแสดงว่า **ยังไม่ได้เชื่อมบริการประชุม** อย่างชัดเจน แชตห้องยังทำงานได้ ไม่มีการจำลองว่าสื่อเชื่อมต่อสำเร็จ

token ใหม่ใช้เชื่อมต่อได้ 60 วินาทีหรือเท่าที่เหลือของเซสชัน การออกห้อง/ถอนสิทธิ์เรียก LiveKit removeParticipant ด้วย การตรวจ session และจำนวนผู้ใช้ของแอปทำที่เซิร์ฟเวอร์ อย่างไรก็ตามระบบ LiveKit ภายนอกต้องเข้าถึงได้จึงยืนยันการตัดสื่อได้ และควรทดสอบการ reconnect/ถอนสิทธิ์จริงก่อนเปิดใช้งานองค์กร

ไม่มีฟังก์ชันเริ่มบันทึกเสียง/วิดีโอในแอป และ token ผู้ใช้ไม่มีสิทธิ์ roomRecord; การตั้งค่าบันทึกอัตโนมัติของ LiveKit ภายนอกอยู่ในการดูแลขององค์กร

## เปิดกลุ่มทดลองบนเซิร์ฟเวอร์

```sh
pnpm build
pnpm start
```

Production ปิดเส้นทาง demo login และตรวจค่า HTTPS origin, โดเมน, ผู้ดูแล และ session secret ก่อนเริ่ม ใช้ reverse proxy ที่รองรับ WebSocket `/ws` พร้อม HTTPS; หากรันใน container กำหนด `HOST=0.0.0.0` และต่อ volume ถาวรให้ `/app/data` ห้ามเปิดโหมด demo ออกเครือข่าย

แอปรุ่นนี้ใช้เซิร์ฟเวอร์หนึ่ง process และสำนักงานหนึ่งแห่ง Presence อยู่ใน memory; สมาชิก ที่นั่ง แชต คำเชิญ และเซสชันอยู่ใน SQLite การเริ่ม process ใหม่ให้ผู้ใช้เชื่อมต่อใหม่ ไม่ได้ออกแบบให้รันหลาย replica โดยแชร์ presence อัตโนมัติ

ก่อน pilot จริงต้องยืนยันผู้ให้บริการบัญชีและ LiveKit, นโยบายข้อมูลขององค์กร, ค่าใช้จ่าย และทดสอบ media/concurrency ตามเป้าหมาย ขนาด 20 คนออนไลน์และ 8 คนต่อห้องเป็นเพดานที่บังคับใช้ในโค้ด ยังไม่ใช่ผล load test สื่อจริง

## โครงสร้าง

```text
src/                React UI, แผนผัง SVG และห้องประชุม
shared/world.js     เรขาคณิต การชน เส้นทาง ห้อง และที่นั่ง
shared/motion.js    การแสดงจังหวะก้าวตามเวลาของเซิร์ฟเวอร์
server/auth.mjs     OIDC และโหมดเดโมที่จำกัด loopback
server/office.mjs   กฎ presence, ห้อง, สิทธิ์, การเดิน และแชต
server/store.mjs    SQLite และอายุข้อมูล
server/index.mjs    HTTP, WebSocket, session cookies และ media tokens
tests/              ทดสอบกฎโดเมนและ HTTP/WebSocket จริง
docs/               ข้อกำหนด คำศัพท์ และ ADR
```

เอกสารอ้างอิง: [openid-client](https://github.com/panva/openid-client), [LiveKit React](https://docs.livekit.io/reference/components/react/component/livekitroom/), [LiveKit tokens](https://docs.livekit.io/frontends/reference/tokens-grants/)
