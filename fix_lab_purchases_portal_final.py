path = "frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx"
with open(path) as f:
    content = f.read()

old = '''                          onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                          title="More"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100"
                        >
                          <MoreVertical size={15} />
                        </button>

                        {openMenuId === p.id && (
                          <div
                            className="absolute right-0 top-9 z-20 bg-white border border-clinical-200 rounded-lg shadow-lg py-1 w-48 text-left"
                            onMouseLeave={() => setOpenMenuId(null)}
                          >'''

new = '''                          onClick={(e) => {
                            if (openMenuId === p.id) {
                              setOpenMenuId(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 });
                            setOpenMenuId(p.id);
                          }}
                          title="More"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100"
                        >
                          <MoreVertical size={15} />
                        </button>

                        {openMenuId === p.id && menuPos && createPortal(
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div
                              className="fixed z-50 bg-white border border-clinical-200 rounded-lg shadow-lg py-1 w-48 text-left"
                              style={{ top: menuPos.top, left: menuPos.left }}
                            >'''

count = content.count(old)
if count != 1:
    raise SystemExit(f"Expected exactly 1 match for opener block, found {count}")
content = content.replace(old, new, 1)

# Close the portal: the original ends with "</div>\n                        )}\n                      </div>\n                    </td>"
old_close = '''                          </div>
                        )}
                      </div>
                    </td>'''
new_close = '''                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </td>'''

count2 = content.count(old_close)
if count2 != 1:
    raise SystemExit(f"Expected exactly 1 match for closer block, found {count2}")
content = content.replace(old_close, new_close, 1)

with open(path, "w") as f:
    f.write(content)
print("Patched:", path)
