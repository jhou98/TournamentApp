# **Friendsgiving Badminton Tournament — Vibe Coding User Stories**

## **1\. Product Overview**

Build a web application to manage a 24-person Friendsgiving badminton tournament.

The tournament consists of:

* **24 players**  
* **4 teams of 6 players**  
* Each team has **1 captain**  
* Teams compete in a **3-round round robin**  
* Every team plays every other team exactly once  
* Each team matchup consists of **2 rounds of doubles games**  
* Each round consists of **3 doubles matches**  
* Captains select their team's three pairs  
* The website randomly matches the three pairs against the opposing team's three pairs  
* The top four teams advance to playoffs  
* Playoffs use a **\#1 vs \#4 / \#2 vs \#3** semifinal structure  
* Semifinals consist of two rounds of three doubles matches  
* Finals use the same two-round format  
* Tied playoff matchups are decided by **1v1 sudden death**  
* Players earn and spend **coins**  
* Players can purchase and use **power-ups**  
* Teams can have **bounties**  
* Players receive **losing-streak protection**  
* A **playoff shop** opens once pool play ends  
* A Commissioner/Admin can create **secret missions and tournament-wide events**

---

# **2\. User Roles**

The application should have three primary roles.

### **Player**

Players can:

* View their profile  
* View their team  
* View their captain  
* View tournament schedule  
* View standings  
* View match results  
* Manage their personal coins  
* Purchase personal power-ups  
* View and complete secret missions  
* View tournament events

### **Captain**

Captains have all Player permissions plus:

* Manage their team  
* Select three doubles pairs for each matchup  
* Reshuffle pairs between rounds  
* Submit and lock lineups  
* View team performance  
* View player performance  
* Make strategic team decisions  
* Manage eligible team power-ups  
* Select sudden-death representatives  
* View captain-specific information

### **Admin / Commissioner**

Admins have full tournament control and can:

* Create/manage tournament  
* Manage players  
* Manage teams  
* Assign captains  
* Manage schedules  
* Enter/edit results  
* Manage coins  
* Create/manage power-ups  
* Create/manage bounties  
* Create secret missions  
* Trigger tournament events  
* Manage playoff bracket  
* Override tournament settings  
* View complete tournament activity history

---

# **3\. Player & Team Management**

### **Players**

* **As an admin, I want to add players to the tournament so that all 24 participants can be managed by the system.**  
* **As an admin, I want to remove players so that the participant list remains accurate.**  
* **As a player, I want to view my profile so that I can see my tournament information.**  
* **As a player, I want to see my team so that I know who I am playing with.**  
* **As a player, I want to see my captain so that I know who is making team decisions.**  
* **As an admin, I want to assign players to one of four teams.**  
* **As an admin, I want to assign one captain to each team.**  
* **As an admin, I want to manually change team assignments if necessary.**  
* **As an admin, I want to randomly generate balanced teams if desired.**

### **Team**

Each team should have:

* Team name  
* Six players  
* One captain  
* Team record  
* Games won  
* Games lost  
* Game differential  
* Current ranking  
* Coin information  
* Match history

---

# **4\. Round-Robin Tournament**

The round robin consists of exactly **three rounds**.

### **Round 1**

* Team A vs Team B  
* Team C vs Team D

### **Round 2**

* Team A vs Team C  
* Team B vs Team D

### **Round 3**

* Team A vs Team D  
* Team B vs Team C

Requirements:

* Every team plays exactly once per round.  
* Every team plays every other team exactly once.  
* Both team matchups can occur simultaneously.  
* The tournament has six courts available.  
* All six doubles games can therefore occur simultaneously.

User stories:

* **As an admin, I want the system to automatically generate the three round-robin rounds.**  
* **As a player, I want to see my team's upcoming opponent.**  
* **As a player, I want to see the complete tournament schedule.**  
* **As an admin, I want to manually modify the schedule if necessary.**  
* **As an admin, I want to assign games to courts.**  
* **As an admin, I want to manually change court assignments.**

---

# **5\. Team Matchup Structure**

Each team matchup consists of **two rounds of doubles**.

For example:

### **Team A vs Team B**

**Round 1**

Team A captain selects:

* Pair A1  
* Pair A2  
* Pair A3

Team B captain selects:

* Pair B1  
* Pair B2  
* Pair B3

The website randomly matches the pairs.

Example:

> A1 vs B3  
> A2 vs B1  
> A3 vs B2

### **Round 2**

Both captains submit **three new pairs**.

The website randomly assigns the three matchups again.

This means each team matchup consists of:

**6 total doubles games**

---

# **6\. Captain Lineup Management**

Captains are responsible for their team's pair selection.

### **Pair selection**

* **As a captain, I want to select three doubles pairs from my six players.**  
* **As a captain, I want to select different pair combinations for each round.**  
* **As a captain, I want to see which players are available before selecting pairs.**  
* **As a captain, I want to see previous pairings and results.**  
* **As a captain, I want to see player performance history.**  
* **As a captain, I want to see how players have performed with previous partners.**  
* **As a captain, I want to submit my lineup once I am satisfied with it.**  
* **As a captain, I want my lineup to lock after submission.**  
* **As an admin, I want to unlock or modify a lineup if necessary.**

### **Pairing restrictions**

The system should:

* Require exactly 3 pairs.  
* Require exactly 6 players.  
* Prevent a player from appearing in multiple pairs in the same round.  
* Prevent duplicate pairings within the same team matchup.  
* Prevent invalid or incomplete lineups.  
* Allow players to be paired with different teammates in subsequent rounds.

---

# **7\. Random Matchup Assignment**

Once both captains submit their lineups:

* The website randomly matches Team A's three pairs against Team B's three pairs.  
* Neither captain chooses the individual opposing pair.  
* The random assignment should be recorded.  
* The randomization should occur only after both lineups are locked.

User stories:

* **As a captain, I want the website to randomly match my three pairs against the opposing team's three pairs.**  
* **As a player, I want to see my randomized opponent once the matchups are revealed.**  
* **As an admin, I want the random matchup assignments recorded so that the result cannot be disputed.**  
* **As an admin, I want to rerun randomization only before games begin if there is a technical issue.**

---

# **8\. Match Results**

Each doubles game produces a winner and loser.

The team matchup therefore produces:

* 3–0  
* 2–1  
* 1–2  
* 0–3

User stories:

* **As an admin, I want to enter the score for each doubles game.**  
* **As an admin, I want to record which team won each game.**  
* **As a player, I want to see my individual game results.**  
* **As a team, I want our three-game round score automatically calculated.**  
* **As a team, I want our overall matchup score automatically calculated.**  
* **As an admin, I want to edit incorrect results.**

---

# **9\. Standings & Seeding**

After each round, the website should update team standings.

Track:

* Team wins  
* Team losses  
* Games won  
* Games lost  
* Game differential  
* Ranking

Default ranking order:

1. Team record  
2. Game differential  
3. Additional admin-defined tiebreaker if required

User stories:

* **As a player, I want to see the current team standings.**  
* **As a player, I want to see my team's record.**  
* **As a player, I want to see game differential.**  
* **As an admin, I want the system to automatically rank teams.**  
* **As an admin, I want to configure the tiebreaker rules.**  
* **As an admin, I want the final round-robin standings to automatically determine playoff seeding.**

---

# **10\. Playoffs**

After the round robin:

### **Semifinal 1**

**\#1 vs \#4**

### **Semifinal 2**

**\#2 vs \#3**

Each semifinal consists of:

* Round 1: three doubles games  
* Round 2: three doubles games  
* Six total games

Captains submit new pairings for each round.

The team with the most total game wins advances.

Example:

> Team \#1: 4 wins  
> Team \#4: 2 wins

> **Team \#1 advances**

---

# **11\. Playoff Sudden Death**

If a semifinal or final finishes:

**3–3**

The system triggers sudden death.

User stories:

* **As an admin, I want the system to automatically trigger sudden death when a playoff matchup finishes 3–3.**  
* **As a captain, I want to select one player to represent my team in sudden death.**  
* **As a captain, I want to see which players are eligible for sudden death.**  
* **As an admin, I want to prevent multiple representatives from being selected.**  
* **As a player, I want to see who has been selected to represent each team.**  
* **As an admin, I want to enter the sudden-death result separately from the doubles games.**

Default sudden-death rules:

> 1v1  
> First to 5  
> Win by 2  
> Maximum score of 7

The winner advances.

---

# **12\. Finals**

The championship final uses the same structure as the semifinals.

* Two rounds  
* Three doubles games per round  
* Six total games  
* New pair selections each round  
* Randomized matchups  
* Most total wins becomes champion  
* 3–3 triggers sudden death

User stories:

* **As a player, I want to see the championship matchup clearly displayed.**  
* **As a captain, I want to submit new pairs for each final round.**  
* **As a player, I want to see the cumulative final score.**  
* **As an admin, I want the system to automatically declare the tournament champion.**  
* **As an admin, I want the championship result permanently recorded in tournament history.**

---

# **13\. Coin Economy**

Players have individual coin balances.

Coins can be earned through:

* Match results  
* Losing streak protection  
* Bounties  
* Performance bonuses  
* Secret missions  
* Commissioner rewards  
* Special tournament events

Coins can be spent on power-ups.

### **Base match rewards**

Suggested default:

| Result | Coins |
| ----- | ----- |
| Win | 100 |
| Close loss | 75 |
| Loss | 50 |

The exact scoring thresholds can be configurable by Admin.

User stories:

* **As a player, I want my coin balance automatically updated after every match.**  
* **As a player, I want to see why I earned coins.**  
* **As a player, I want to see my complete coin transaction history.**  
* **As an admin, I want to manually add or remove coins.**  
* **As an admin, I want every coin transaction recorded in an audit log.**  
* **As an admin, I want to reverse incorrect coin transactions.**

---

# **14\. Losing Streak Protection**

Suggested default:

| Consecutive Losses | Bonus |
| ----- | ----- |
| 2 | \+25 🪙 |
| 3 | \+50 🪙 |
| 4+ | \+75 🪙 |

The streak resets after a win.

User stories:

* **As a player, I want to receive a bonus after consecutive losses so that I can remain economically competitive.**  
* **As a player, I want my losing streak to reset after a win.**  
* **As an admin, I want to configure losing-streak rewards.**  
* **As an admin, I want the system to automatically calculate losing-streak bonuses.**  
* **As a player, I want to see when and why I received a losing-streak bonus.**

---

# **15\. Bounty System**

Admins can place bounties on players or teams.

Example bounties:

* Beat \#1 team → \+75  
* Beat a team ranked 3+ places higher → \+50  
* Revenge win → \+40  
* Major upset → \+25

Bounties can stack.

User stories:

* **As an admin, I want to create a bounty on a player or team.**  
* **As an admin, I want to set the coin value of a bounty.**  
* **As an admin, I want to define the conditions required to claim a bounty.**  
* **As a player, I want to see active bounties.**  
* **As the system, I want to automatically determine when a bounty has been completed.**  
* **As a player, I want multiple qualifying bounties to stack.**  
* **As an admin, I want to create custom bounties during the tournament.**  
* **As a player, I want to see which bounty I earned after a match.**

---

# **16\. Power-Up Shop**

Players can spend coins on power-ups.

Each power-up has:

* Name  
* Description  
* Price  
* Category  
* Usage restrictions  
* Duration  
* Quantity/availability  
* Activation requirements

Suggested categories:

* Individual  
* Team  
* Whole court  
* Secret Commissioner  
* Playoff exclusive

User stories:

* **As a player, I want to browse available power-ups.**  
* **As a player, I want to see the price of each power-up.**  
* **As a player, I want to see exactly what each power-up does before purchasing it.**  
* **As a player, I want to purchase a power-up using my coins.**  
* **As the system, I want to prevent purchases when the player has insufficient coins.**  
* **As a player, I want to see my currently owned power-ups.**  
* **As a player, I want to see whether a power-up has already been used.**  
* **As an admin, I want to create custom power-ups.**  
* **As an admin, I want to set power-up prices.**  
* **As an admin, I want to activate or deactivate power-ups.**  
* **As an admin, I want to set usage restrictions.**

---

# **17\. Power-Up Activation**

Power-ups need defined activation timing.

Possible activation windows:

* Before a matchup  
* Before a round  
* Before an individual game  
* During an individual game  
* After a point  
* Once per tournament

User stories:

* **As an admin, I want to define when a power-up can be activated.**  
* **As a player, I want to know when I am allowed to activate a power-up.**  
* **As a player, I want to activate my power-up through the website.**  
* **As the system, I want to timestamp power-up activations.**  
* **As the system, I want used power-ups removed from the player's available inventory.**  
* **As an admin, I want to manually approve or override a power-up activation.**

---

# **18\. Playoff Shop**

The playoff shop opens when round-robin play ends.

Coins carry over from pool play.

Suggested pricing:

* Standard → 100  
* Strong → 150  
* Playoff exclusive → 200  
* Legendary → 300+

User stories:

* **As an admin, I want to activate the playoff shop after round-robin play.**  
* **As a player, I want to carry my pool-play coins into the playoffs.**  
* **As a player, I want to see playoff-exclusive power-ups.**  
* **As an admin, I want to create playoff-exclusive power-ups.**  
* **As an admin, I want to set playoff power-up prices.**  
* **As an admin, I want to limit certain playoff power-ups to one purchase per player.**  
* **As a player, I want to see how many limited power-ups remain.**  
* **As an admin, I want to close the playoff shop before the championship final.**

---

# **19\. Secret Commissioner Missions**

The Commissioner can secretly assign missions to individual players.

Examples:

> Make your partner laugh during a match.

> Win a game using a particular strategy.

> Get an opponent to say a specific word.

> Complete an unusual badminton challenge.

User stories:

* **As a Commissioner, I want to secretly assign a mission to a specific player.**  
* **As a player, I want to see only my own secret missions.**  
* **As a Commissioner, I want to assign a coin reward to each mission.**  
* **As a Commissioner, I want to set an expiration round for a mission.**  
* **As a Commissioner, I want to manually mark a mission as completed.**  
* **As a player, I want to receive my reward after the Commissioner approves my mission.**  
* **As a Commissioner, I want to create custom missions during the tournament.**  
* **As a Commissioner, I want to hide the existence of a mission from everyone except the assigned player.**

---

# **20\. Tournament Events / Commissioner Chaos**

The Commissioner can trigger temporary tournament-wide events.

Examples:

### **Silent Library**

Everyone must remain silent during the next round.

### **Double Coins**

All qualifying coin rewards are doubled for one round.

### **Chaos Round**

The Commissioner determines the pairings.

### **Bounty Hunter**

Defeating the current \#1 team gives an additional reward.

User stories:

* **As a Commissioner, I want to create tournament-wide events.**  
* **As a Commissioner, I want to specify which round or games an event affects.**  
* **As a Commissioner, I want to activate an event instantly.**  
* **As a player, I want to receive an announcement when an event begins.**  
* **As an admin, I want active events displayed prominently on the tournament dashboard.**  
* **As a Commissioner, I want events to automatically expire after their designated duration.**

---

# **21\. Live Tournament Dashboard**

The main screen should show the current state of the tournament.

Display:

### **Tournament standings**

* Rank  
* Team  
* Record  
* Games won/lost  
* Game differential  
* Coins

### **Current round**

* Matchups  
* Courts  
* Players  
* Pairings  
* Scores

### **Economy**

* Coin leaderboard  
* Active bounties  
* Recent purchases

### **Commissioner**

* Active events  
* Recent announcements  
* Major tournament events

User stories:

* **As a player, I want to see the live tournament standings.**  
* **As a player, I want to see current games and scores.**  
* **As a player, I want to see upcoming matchups.**  
* **As a player, I want to see the coin leaderboard.**  
* **As a player, I want to see active bounties.**  
* **As a player, I want to see active tournament events.**  
* **As an admin, I want the dashboard to update automatically when results are entered.**

---

# **22\. Captain Dashboard**

Captains should have a dedicated interface.

Display:

### **Team**

* Team name  
* Players  
* Record  
* Ranking  
* Game differential

### **Upcoming matchup**

* Opponent  
* Round  
* Lineup selection  
* Submission status

### **Team history**

* Previous pairings  
* Results  
* Player performance

### **Strategic information**

* Available team power-ups  
* Relevant bounties  
* Team coin balance, if applicable

User stories:

* **As a captain, I want a dedicated captain dashboard so that I can manage my team.**  
* **As a captain, I want to see my team's complete performance history.**  
* **As a captain, I want to see previous pair combinations and their results.**  
* **As a captain, I want to see my team's available strategic resources.**  
* **As a captain, I want clear confirmation when my lineup has been successfully submitted.**

---

# **23\. Notifications & Announcements**

The system should notify users when important events occur.

Examples:

* New round begins  
* Pair selection opens  
* Pair selection closes  
* Matchups randomized  
* Match result entered  
* Coins awarded  
* Bounty completed  
* Power-up purchased  
* Secret mission assigned  
* Playoff shop opened  
* Playoffs begin  
* Sudden death triggered  
* Championship won

User stories:

* **As a player, I want to receive notifications about important tournament events.**  
* **As a captain, I want to be notified when lineup submission opens.**  
* **As a captain, I want to be notified when lineup submission closes.**  
* **As an admin, I want to send custom tournament announcements.**

---

# **24\. Tournament History / Audit Log**

Every important action should be recorded.

Track:

* Match results  
* Lineup submissions  
* Randomized matchups  
* Coin transactions  
* Power-up purchases  
* Power-up activations  
* Bounties  
* Missions  
* Tournament events  
* Admin changes  
* Captain decisions

User stories:

* **As an admin, I want to view a complete chronological tournament activity log.**  
* **As an admin, I want every coin transaction to have a reason and timestamp.**  
* **As an admin, I want every lineup submission to be recorded.**  
* **As an admin, I want randomized matchups recorded.**  
* **As an admin, I want to see who made each administrative change.**  
* **As an admin, I want to correct mistakes without deleting the original history.**

---

# **25\. Core Data Model**

I'd give the vibe-coding AI this section **after the user stories**, because it gives it an idea of how the application should be structured.

The system should have, at minimum, these entities:

Tournament  
Player  
Team  
Captain  
Round  
TeamMatchup  
Lineup  
Pair  
Game  
Court  
Standing  
CoinTransaction  
PowerUp  
PowerUpPurchase  
PowerUpActivation  
Bounty  
Mission  
TournamentEvent  
Playoff  
SuddenDeath  
Notification  
ActivityLog

### **Important relationships**

Tournament  
 ├── 24 Players  
 ├── 4 Teams  
 │    ├── 6 Players  
 │    └── 1 Captain  
 │  
 ├── Round Robin  
 │    ├── Round 1  
 │    ├── Round 2  
 │    └── Round 3  
 │  
 ├── Playoffs  
 │    ├── Semifinal 1  
 │    ├── Semifinal 2  
 │    └── Final  
 │  
 ├── Coins  
 ├── Power-Ups  
 ├── Bounties  
 ├── Missions  
 └── Commissioner Events  
---

# **26\. Critical Business Rules**

I'd put these in a separate section for the coding agent so it knows these aren't optional suggestions.

### **Tournament**

1. There are exactly **4 teams of 6** players.  
2. Each team has exactly **1 captain**.  
3. Every team plays every other team exactly once in round robin.  
4. There are exactly **3 round-robin rounds**.  
5. Each team plays once per round.  
6. Each team matchup has **two rounds of doubles**.  
7. Each doubles round has exactly **3 games**.  
8. Each team must submit exactly **3 pairs**.  
9. Each player can only appear in one pair per round.  
10. The website randomly matches the three pairs.  
11. Captains cannot control the randomized individual matchups.  
12. Playoff seeding is based on final round-robin standings.  
13. Semifinals are **\#1 vs \#4** and **\#2 vs \#3**.  
14. Each semifinal has six doubles games.  
15. The team with the most wins advances.  
16. A **3–3** playoff result triggers sudden death.  
17. Sudden death is **1v1, first to 5, win by 2, capped at 7**.  
18. Finals follow the same six-game structure.  
19. A **3–3 final triggers sudden death**.

### **Economy**

20. Every player has an individual coin balance.  
21. Coins persist throughout the tournament.  
22. Coins carry from pool play into playoffs.  
23. Every coin transaction must be logged.  
24. Losing streak bonuses reset after a win.  
25. Bounties can stack.  
26. Players cannot purchase power-ups without sufficient coins.  
27. Used power-ups cannot be reused unless explicitly configured as reusable.  
28. The playoff shop opens after round-robin play.  
29. Admins control power-up availability and pricing.

### **Permissions**

30. Players cannot select their team's lineup.  
31. Only the captain can submit a team lineup.  
32. Admins can override captain decisions.  
33. Players can manage their own personal power-ups.  
34. Commissioners/Admins can create secret missions.  
35. Players cannot see another player's secret missions.  
36. Admins have access to all tournament data.

---

# **27\. Build Priority**

For the vibe-coding process, I **wouldn't ask it to build everything at once**. I'd give it this priority:

### **Phase 1 — Tournament Engine**

1. Players  
2. Teams  
3. Captains  
4. Round-robin schedule  
5. Captain lineup selection  
6. Random matchup generation  
7. Court assignment  
8. Match scoring  
9. Standings  
10. Playoff bracket  
11. Sudden death  
12. Finals

### **Phase 2 — Economy**

13. Coins  
14. Coin transactions  
15. Match rewards  
16. Losing streak protection  
17. Bounties  
18. Coin leaderboard

### **Phase 3 — Power-Ups**

19. Power-up database  
20. Shop  
21. Purchases  
22. Inventory  
23. Activation  
24. Usage restrictions  
25. Playoff shop

### **Phase 4 — Commissioner**

26. Secret missions  
27. Secret rewards  
28. Tournament events  
29. Commissioner dashboard

### **Phase 5 — Polish**

30. Live dashboard  
31. Notifications  
32. Animations  
33. Tournament activity feed  
34. Tournament history  
35. Mobile-friendly interface

**One architectural recommendation:** have the coding agent build the **tournament engine and permissions first**, before styling the site heavily. The most complicated part isn't the UI — it's correctly handling the relationships between **captains → lineups → randomized matchups → results → standings → playoffs → coins → power-ups**. Once that engine is solid, you can make the front end as ridiculous and Friendsgiving-y as you want.

