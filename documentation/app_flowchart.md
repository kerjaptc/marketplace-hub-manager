flowchart TD
    Start[Start] --> LandingPage[Landing Page]
    LandingPage -->|No session| Auth[User Authentication]
    Auth -->|Success| Dashboard[Protected Dashboard]
    Dashboard -->|User action Sync Products| SyncAction[Sync Products Action]
    SyncAction --> APIRoute[Next js API Route]
    APIRoute --> Integration[Service Integration Module]
    Integration --> ExternalAPI[External Marketplace API]
    ExternalAPI --> Normalization[Normalize Data]
    Normalization --> SaveDB[Save To Database]
    SaveDB --> FetchDB[Fetch Aggregated Data]
    FetchDB --> Display[Display In Data Table]
    Dashboard -->|View Data| Display