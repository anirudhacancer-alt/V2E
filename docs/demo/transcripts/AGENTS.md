# Construction Progress Call Dataset for NLP

| File | Role |
|------|------|
| [construction_calls_dataset.csv.csv](./construction_calls_dataset.csv.csv) | NLP research transcript rows. |
| [sample_patterns.json](./sample_patterns.json) | Sample extraction patterns. |

## Overview
Synthetic dataset of 200 construction site supervisor call transcripts designed for automated progress tracking using NLP. Validated subset of 50 transcripts with ground truth annotations.

## Dataset Description
- **Total Transcripts**: 200 (100 Positive, 50 Negative, 50 Neutral)
- **Validated Subset**: 50 transcripts with expert annotations
- **Domains**: Labor hours tracking, completion rate extraction, progress summarization
- **Departments**: Concrete, Masonry, Metals, Woods, Doors, Electrical, Plumbing, Carpentry

## Validation Results
- Labor Extraction: F1-Score 87.9%, Precision 100%
- Completion Extraction: F1-Score 74.0%, Precision 86%
- Pattern Coverage: 98%+
- Expert Realism Score: 5.45 (Cohen's Kappa)

## Use Cases
1. Training NLP models for construction progress extraction
2. Testing rule-based pattern recognition systems
3. Benchmarking speech-to-text + information extraction pipelines
4. Research in construction domain NLP

## Dataset Composition

- **Total Transcripts**: 200
  - 100 Positive scenarios
  - 50 Negative scenarios  
  - 50 Neutral scenarios

- **Validated Subset**: 50 transcripts (25 Positive, 13 Negative, 12 Neutral)
  - Includes ground truth annotations for:
    - Labor hours (person, hours worked, department)
    - Completion rates (department, percentage)
    - Progress summaries (key updates/issues)
  - Expert-validated with Kappa score: 5.45
  - Automated validation: F1-scores of 87.9% (labor) and 74% (completion)

## Usage Scenarios

### Scenario 1: Semi-Supervised Learning
df = pd.read_csv('construction_calls_dataset.csv')

# Use unvalidated for unsupervised pattern discovery
unvalidated = df[df['validated'] == False]  # 150 transcripts

# Use validated for testing
validated = df[df['validated'] == True]  # 50 transcripts with ground truth

### Scenario 2: Supervised Learning (Validated Only)
# Split into train/test or use k-fold cross-validation
validated_only = df[df['validated'] == True]

### Scenario 3: Full Dataset Analysis
# Analyze all 200 for diversity, patterns, linguistic features
full_analysis = df['transcript'].apply(your_analysis_function)


## Citation
If you use this dataset, please cite:
Iynkaran Pavanantham. (2025). Construction Progress Call Dataset for NLP. Kaggle.

## Research Background
This dataset was created as part of a Final Year Project on automated construction progress tracking using pattern recognition and adaptive learning. See validation_report.pdf for methodology.

## License
CC BY 4.0 (Creative Commons Attribution)