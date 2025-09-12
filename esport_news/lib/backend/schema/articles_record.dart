import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class ArticlesRecord extends FirestoreRecord {
  ArticlesRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "title" field.
  String? _title;
  String get title => _title ?? '';
  bool hasTitle() => _title != null;

  // "slug" field.
  String? _slug;
  String get slug => _slug ?? '';
  bool hasSlug() => _slug != null;

  // "summary" field.
  String? _summary;
  String get summary => _summary ?? '';
  bool hasSummary() => _summary != null;

  // "coverUrl" field.
  String? _coverUrl;
  String get coverUrl => _coverUrl ?? '';
  bool hasCoverUrl() => _coverUrl != null;

  // "content" field.
  String? _content;
  String get content => _content ?? '';
  bool hasContent() => _content != null;

  // "publishedAt" field.
  DateTime? _publishedAt;
  DateTime? get publishedAt => _publishedAt;
  bool hasPublishedAt() => _publishedAt != null;

  // "updatedAt" field.
  DateTime? _updatedAt;
  DateTime? get updatedAt => _updatedAt;
  bool hasUpdatedAt() => _updatedAt != null;

  // "status" field.
  String? _status;
  String get status => _status ?? '';
  bool hasStatus() => _status != null;

  // "tags" field.
  List<String>? _tags;
  List<String> get tags => _tags ?? const [];
  bool hasTags() => _tags != null;

  void _initializeFields() {
    _title = snapshotData['title'] as String?;
    _slug = snapshotData['slug'] as String?;
    _summary = snapshotData['summary'] as String?;
    _coverUrl = snapshotData['coverUrl'] as String?;
    _content = snapshotData['content'] as String?;
    _publishedAt = snapshotData['publishedAt'] as DateTime?;
    _updatedAt = snapshotData['updatedAt'] as DateTime?;
    _status = snapshotData['status'] as String?;
    _tags = getDataList(snapshotData['tags']);
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('articles');

  static Stream<ArticlesRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => ArticlesRecord.fromSnapshot(s));

  static Future<ArticlesRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => ArticlesRecord.fromSnapshot(s));

  static ArticlesRecord fromSnapshot(DocumentSnapshot snapshot) =>
      ArticlesRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static ArticlesRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      ArticlesRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'ArticlesRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is ArticlesRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createArticlesRecordData({
  String? title,
  String? slug,
  String? summary,
  String? coverUrl,
  String? content,
  DateTime? publishedAt,
  DateTime? updatedAt,
  String? status,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'title': title,
      'slug': slug,
      'summary': summary,
      'coverUrl': coverUrl,
      'content': content,
      'publishedAt': publishedAt,
      'updatedAt': updatedAt,
      'status': status,
    }.withoutNulls,
  );

  return firestoreData;
}

class ArticlesRecordDocumentEquality implements Equality<ArticlesRecord> {
  const ArticlesRecordDocumentEquality();

  @override
  bool equals(ArticlesRecord? e1, ArticlesRecord? e2) {
    const listEquality = ListEquality();
    return e1?.title == e2?.title &&
        e1?.slug == e2?.slug &&
        e1?.summary == e2?.summary &&
        e1?.coverUrl == e2?.coverUrl &&
        e1?.content == e2?.content &&
        e1?.publishedAt == e2?.publishedAt &&
        e1?.updatedAt == e2?.updatedAt &&
        e1?.status == e2?.status &&
        listEquality.equals(e1?.tags, e2?.tags);
  }

  @override
  int hash(ArticlesRecord? e) => const ListEquality().hash([
        e?.title,
        e?.slug,
        e?.summary,
        e?.coverUrl,
        e?.content,
        e?.publishedAt,
        e?.updatedAt,
        e?.status,
        e?.tags
      ]);

  @override
  bool isValidKey(Object? o) => o is ArticlesRecord;
}
