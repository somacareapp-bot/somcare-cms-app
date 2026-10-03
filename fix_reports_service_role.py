import pathlib, re

BASE = "/Users/adminnopassword/Documents/Clinical MS/cms"
path = pathlib.Path(BASE) / "backend/src/reports/reports.service.ts"
src = path.read_text()

# Replace the doctor query — can't filter by role column so fetch all users
# and filter by role in JS, same as how jwt.strategy returns roles[]
old = "    const allDoctors = await this.usersRepo.find({ where: { role: 'doctor' as any } });"
new = """    // User entity stores roles via a join table, not a plain column.
    // Fetch all users and filter in memory by role name.
    const allUsers = await this.usersRepo.find({ relations: ['roles'] });
    const allDoctors = allUsers.filter((u: any) =>
      (u.roles ?? []).some((r: any) =>
        (typeof r === 'string' ? r : r.name ?? '').toLowerCase().includes('doctor')
      )
    );"""

if old in src:
    src = src.replace(old, new)
    # also remove the now-redundant allStaff query and replace
    old2 = "    const allStaff = await this.usersRepo.find();"
    new2 = "    const allStaff = allUsers;"
    src = src.replace(old2, new2)
    path.write_text(src)
    print("OK — doctor filter fixed (roles relation, in-memory)")
    print("OK — allStaff reuses allUsers (no second DB call)")
else:
    print("WARN — old line not found; checking current content...")
    # Try a broader replacement
    src = re.sub(
        r"const allDoctors = await this\.usersRepo\.find\(\{[^}]+\}\);",
        "const allDoctors = allUsers.filter((u: any) => (u.roles ?? []).some((r: any) => (typeof r === 'string' ? r : r.name ?? '').toLowerCase().includes('doctor')));",
        src
    )
    src = re.sub(
        r"const allStaff = await this\.usersRepo\.find\(\);",
        "const allStaff = allUsers;",
        src
    )
    # Add allUsers fetch before allDoctors
    src = src.replace(
        "    // User entity stores roles",
        "    const allUsers = await this.usersRepo.find({ relations: ['roles'] });\n    // User entity stores roles",
    )
    if "const allUsers" not in src:
        src = src.replace(
            "    const allDoctors",
            "    const allUsers = await this.usersRepo.find({ relations: ['roles'] });\n    const allDoctors",
        )
    path.write_text(src)
    print("OK — broad replacement applied")

print("Done — backend should compile now. Check the terminal.")
