path = "frontend/src/components/layout/Sidebar.tsx"
with open(path, "r") as f:
    content = f.read()

changes = 0

# ── 1. Section titles (Dashboard, Patient Flow, Clinical, Finance, Operations)
#    -> bold, bright orange, clearly visible
section_variants = [
    # from the "bold fonts" patch applied earlier
    '''              {!collapsed && (
                <p className="text-[11px] font-extrabold text-white/70 uppercase tracking-widest px-2 mb-1 mt-1">
                  {section.section}
                </p>
              )}''',
    # original, in case the earlier patch wasn't applied
    '''              {!collapsed && (
                <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest px-2 mb-1 mt-1">
                  {section.section}
                </p>
              )}''',
]
section_new = '''              {!collapsed && (
                <p className="text-[11px] font-extrabold text-orange-400 uppercase tracking-widest px-2 mb-1 mt-1">
                  {section.section}
                </p>
              )}'''

found_section = False
for variant in section_variants:
    if variant in content:
        content = content.replace(variant, section_new)
        changes += 1
        found_section = True
        break
if not found_section:
    print("WARN: section title anchor not found")

# ── 2. Nav item labels (Triage, Consultation, Billing, etc.) -> plain white,
#    not bold, more subdued so the orange section titles stand out on top
navitem_variants = [
    # from the "bold fonts" patch applied earlier
    '''                      className={`
                        flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors
                        ${collapsed ? 'justify-center px-0' : ''}
                        ${
                          active
                            ? 'bg-primary-600 text-white font-bold'
                            : 'text-white/80 hover:bg-white/8 hover:text-white'
                        }
                      `}''',
    # original
    '''                      className={`
                        flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors
                        ${collapsed ? 'justify-center px-0' : ''}
                        ${
                          active
                            ? 'bg-primary-600 text-white font-medium'
                            : 'text-white/60 hover:bg-white/8 hover:text-white'
                        }
                      `}''',
]
navitem_new = '''                      className={`
                        flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-normal transition-colors
                        ${collapsed ? 'justify-center px-0' : ''}
                        ${
                          active
                            ? 'bg-primary-600 text-white font-normal'
                            : 'text-white/50 hover:bg-white/8 hover:text-white'
                        }
                      `}'''

found_navitem = False
for variant in navitem_variants:
    if variant in content:
        content = content.replace(variant, navitem_new)
        changes += 1
        found_navitem = True
        break
if not found_navitem:
    print("WARN: nav item anchor not found")

if changes == 0:
    print("ERROR: no changes applied — file may already differ from every known version. Aborting without writing.")
    raise SystemExit

with open(path, "w") as f:
    f.write(content)

print(f"SUCCESS: applied {changes}/2 updates — section titles are bold orange, nav item labels are plain white.")
