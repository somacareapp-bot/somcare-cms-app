from pathlib import Path

TARGET = Path("/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/clinical/ConsultationPage.tsx")
src = TARGET.read_text()
ok = True

# 1. Add useEffect to the react import
old_import = "import { useState } from 'react';"
new_import = "import { useState, useEffect, useRef } from 'react';"
if old_import in src:
    src = src.replace(old_import, new_import, 1)
    print("OK — added useEffect, useRef to react import")
else:
    ok = False
    print("WARN — react import line not found verbatim")

# 2. Insert a debounced auto-save effect right after the hydration block
old_anchor = """  if (visit && !initialized) {
    setForm({
      chiefComplaint: visit.chiefComplaint ?? '',
      historyOfPresentIllness: visit.historyOfPresentIllness ?? '',
      examinationFindings: visit.examinationFindings ?? '',
      diagnosis: visit.diagnosis ?? '',
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => visitsApi.updateConsultation(visitId!, form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits', visitId] }),
  });"""

new_block = """  if (visit && !initialized) {
    setForm({
      chiefComplaint: visit.chiefComplaint ?? '',
      historyOfPresentIllness: visit.historyOfPresentIllness ?? '',
      examinationFindings: visit.examinationFindings ?? '',
      diagnosis: visit.diagnosis ?? '',
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => visitsApi.updateConsultation(visitId!, form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits', visitId] }),
  });

  // Auto-save the notes fields ~1s after the doctor stops typing, so nothing is
  // lost if they navigate away without clicking "Save Draft" manually.
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initialized || !visitId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      visitsApi.updateConsultation(visitId, form).then(() => {
        queryClient.invalidateQueries({ queryKey: ['visits', visitId] });
      });
    }, 1000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form.chiefComplaint, form.historyOfPresentIllness, form.examinationFindings, form.diagnosis, initialized, visitId]);"""

if old_anchor in src:
    src = src.replace(old_anchor, new_block, 1)
else:
    ok = False
    print("WARN — hydration/saveMutation block not found verbatim. Run:")
    print('  grep -n -A15 "if (visit && !initialized)" "' + str(TARGET) + '"')
    print("and paste the output.")

if ok:
    TARGET.write_text(src)
    print("OK — debounced auto-save wired to the 4 notes fields (fires 1s after the doctor stops typing)")
    print("SUCCESS — refresh the browser. Type in Chief Complaint etc., wait ~1s, then navigate away and")
    print("back in — the text should now persist without needing to click Save Draft.")
else:
    print("Nothing was written — one or more blocks did not match.")
