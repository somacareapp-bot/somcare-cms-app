path = "frontend/src/components/layout/Sidebar.tsx"
with open(path, "r") as f:
    content = f.read()

changes = 0

# 1. Section labels — bigger, bolder, and more visible than the current
#    barely-there white/35
old = '''              {!collapsed && (
                <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest px-2 mb-1 mt-1">
                  {section.section}
                </p>
              )}'''
new = '''              {!collapsed && (
                <p className="text-[11px] font-extrabold text-white/70 uppercase tracking-widest px-2 mb-1 mt-1">
                  {section.section}
                </p>
              )}'''
if old in content:
    content = content.replace(old, new)
    changes += 1
else:
    print("WARN: section label anchor not found")

# 2. Nav item links — bolder text for both active and inactive states,
#    and brighter inactive color so unselected items are easier to read
old = '''                      className={`
                        flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors
                        ${collapsed ? 'justify-center px-0' : ''}
                        ${
                          active
                            ? 'bg-primary-600 text-white font-medium'
                            : 'text-white/60 hover:bg-white/8 hover:text-white'
                        }
                      `}'''
new = '''                      className={`
                        flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors
                        ${collapsed ? 'justify-center px-0' : ''}
                        ${
                          active
                            ? 'bg-primary-600 text-white font-bold'
                            : 'text-white/80 hover:bg-white/8 hover:text-white'
                        }
                      `}'''
if old in content:
    content = content.replace(old, new)
    changes += 1
else:
    print("WARN: nav item anchor not found")

# 3. Logo wordmark — bump to font-bold for consistency
old = '''          <span className="font-semibold text-sm leading-tight text-white/90 whitespace-nowrap overflow-hidden">
            Somcare CMS
          </span>'''
new = '''          <span className="font-bold text-sm leading-tight text-white whitespace-nowrap overflow-hidden">
            Somcare CMS
          </span>'''
if old in content:
    content = content.replace(old, new)
    changes += 1
else:
    print("WARN: logo anchor not found")

# 4. User row — role text was nearly invisible at white/40; brighten + bolden
old = '''              <p className="text-xs font-semibold text-white/90 truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] text-white/40 capitalize truncate">
                {user.roles?.[0] ?? 'User'}
              </p>'''
new = '''              <p className="text-xs font-bold text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] font-semibold text-white/60 capitalize truncate">
                {user.roles?.[0] ?? 'User'}
              </p>'''
if old in content:
    content = content.replace(old, new)
    changes += 1
else:
    print("WARN: user row anchor not found")

# 5. Collapse / Logout buttons — bolder label text
old = '''          {!collapsed && <span>Collapse</span>}'''
new = '''          {!collapsed && <span className="font-semibold">Collapse</span>}'''
if old in content:
    content = content.replace(old, new)
    changes += 1
else:
    print("WARN: collapse label anchor not found")

old = '''          {!collapsed && <span>Log out</span>}'''
new = '''          {!collapsed && <span className="font-semibold">Log out</span>}'''
if old in content:
    content = content.replace(old, new)
    changes += 1
else:
    print("WARN: logout label anchor not found")

if changes == 0:
    print("ERROR: no changes applied — file may already differ. Aborting without writing.")
    raise SystemExit

with open(path, "w") as f:
    f.write(content)

print(f"SUCCESS: applied {changes}/6 font-weight/visibility updates to Sidebar.tsx")
