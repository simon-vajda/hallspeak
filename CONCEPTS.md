# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Relationships

An Event owns one or more Channels and is deleted with them. A PIN belongs to the Event; a Speaker code belongs to a single Channel. Both are regenerable, so neither identifies its row — regenerating one invalidates the links that carry it without disturbing anything else. Enabled is set independently on an Event and on each of its Channels, and both must be enabled for a guest to reach that Channel.

## Events and channels

### Event
A single occasion being interpreted — one service, one conference session, one talk. An Event is what a guest joins; it carries a name, an optional description, and the Channels a guest chooses between.

### Channel
One interpretation stream within an Event, in practice one target language. A Channel has exactly one Speaker at a time and any number of Listeners.

A Channel's slug is fixed at creation and unique only within its Event. It is deliberately not derived from the editable display name: the slug appears in every printed QR code, so renaming a Channel must not move it.

### Enabled
Whether an Event or a Channel is open to guests. Both default to closed and are opened by a deliberate admin action.

Enabled carries no direction in time — the same closed state means "not yet" before an Event and "over" afterwards. This is why there is no separate lifecycle or status concept: a project looking for one should use Enabled.

### PIN
The short numeric code that grants listening on one Event. A guest types it or receives it inside a Listener link. It is regenerable, which revokes every link and printed code carrying the old value.

### Speaker code
The secret that grants broadcasting on one Channel — never on the Event as a whole. It is regenerable on the same terms as a PIN.

The speaker link is the ordinary Channel URL with the code attached, so stripping the code degrades it into a valid Listener link rather than breaking it.

### Listener link
The URL that takes a guest straight into an Event, carrying its PIN. Also rendered as a QR code for printing or projecting. Possession of the link is the entire authorization to listen.

### Admin
The only authenticated role in the system, and a single account. The Admin creates Events and Channels, enables them, regenerates PINs and Speaker codes, and shares the links.

Speakers and Listeners are deliberately not accounts: they are authorized purely by holding a link or code. Requiring anything more of them is treated as a product defect, not a security improvement.

## Protocol

### Problem
The one error shape every failure crosses a boundary in — a machine-readable code plus a human-readable message. It is transport-agnostic: HTTP responses and socket acknowledgements carry the same shape, so a caller has one thing to handle either way.

A failure that produces no Problem is a bug in whatever produced it, not a case for callers to special-case. Clients synthesize a Problem for failures that never reached the server, so that "the API refused" and "the API never answered" arrive through the same path.

### Signalling
The out-of-band exchange that negotiates a media connection before audio flows — capabilities, transport parameters, producers and consumers. It names a *role* played over the socket, not the socket itself: the transport is a socket, and signalling is one of the things carried on it alongside presence and room membership.
