# spare-parts page — replaced by Alternatives

The previous content of `src/app/(dashboard)/spare-parts/page.tsx` used
this route for the inventory spare-parts module. In the new VMS model,
the sidebar entry labelled **"البدائل / Alternatives"** must drive the
replacement-vehicle (RV) pool instead. To avoid creating a new route
and touching the sidebar/access matrix, we repurpose the existing
`/spare-parts` URL to render the Alternatives page.

The original page source was removed from `page.tsx` on this change.
If you need the spare-parts inventory UI back, the code is still in
git history (previous commit before migration 009).

Database tables `spare_parts` and `spare_part_categories` are untouched.
