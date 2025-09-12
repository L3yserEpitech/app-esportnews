import '/flutter_flow/flutter_flow_util.dart';
import 'package:flutter/material.dart';
import 'blank_list_view_model.dart';
export 'blank_list_view_model.dart';

class BlankListViewWidget extends StatefulWidget {
  const BlankListViewWidget({
    super.key,
    required this.width,
    required this.height,
  });

  final int? width;
  final int? height;

  @override
  State<BlankListViewWidget> createState() => _BlankListViewWidgetState();
}

class _BlankListViewWidgetState extends State<BlankListViewWidget> {
  late BlankListViewModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => BlankListViewModel());

    WidgetsBinding.instance.addPostFrameCallback((_) => safeSetState(() {}));
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: BoxDecoration(),
    );
  }
}
